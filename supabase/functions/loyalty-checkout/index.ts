import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sendWhatsApp(instanceName: string, targetNumber: string, text: string, apiKey: string, baseUrl: string) {
    try {
        console.log(`[WhatsApp] Sending to ${targetNumber} via ${instanceName}...`)
        const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({
                number: targetNumber,
                options: { delay: 1200, presence: "composing" },
                textMessage: { text }
            })
        })
        const resData = await response.json()
        console.log(`[WhatsApp] Response:`, resData)
        return response.ok
    } catch (e) {
        console.error('[WhatsApp] Error:', e)
        return false
    }
}

async function sendEmail(to: string, subject: string, html: string, apiKey: string) {
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                from: 'Clube VIP <notificacoes@lucrocerto.idealzap.com.br>',
                to: [to],
                subject,
                html
            })
        })
        return response.ok
    } catch (e) {
        console.error('Error sending Email via Resend:', e)
        return false
    }
}

serve(async (req) => {
    // 0. Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const resendKey = Deno.env.get('RESEND_API_KEY')
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

        // 1. Get Request body
        const { planId, customer, contactId } = await req.json()
        if (!planId || (!customer && !contactId)) {
            throw new Error('Missing planId, customer or contactId')
        }

        // 1.1 Fetch App Settings (for global templates and keys)
        const { data: appSettings } = await supabaseAdmin.from('app_settings').select('*').eq('id', 1).single()
        console.log('[Loyalty] App Settings loaded:', appSettings ? 'YES' : 'NO')
        if (!appSettings) throw new Error('Global app settings not found')

        // 2. Fetch Plan + Company
        const { data: plan, error: planError } = await supabaseAdmin
            .from('loyalty_plans')
            .select('*, company:companies(id, trade_name, email, phone)')
            .eq('id', planId)
            .single()

        if (planError || !plan) throw new Error('Plano não encontrado.')

        const companyId = plan.company_id
        
        // 3. Loyalty Settings (for gateway type)
        const { data: loyaltySettings, error: settingsError } = await supabaseAdmin
            .from('loyalty_settings')
            .select('*')
            .eq('company_id', companyId)
            .single()

        if (settingsError || !loyaltySettings) throw new Error('Configurações de fidelidade não encontradas.')

        // 4. Gateway Credentials
        const { data: gateway, error: gatewayError } = await supabaseAdmin
            .from('company_payment_gateways')
            .select('*')
            .eq('company_id', companyId)
            .eq('provider', loyaltySettings.gateway_type)
            .eq('is_active', true)
            .single()

        if (gatewayError || !gateway) {
            throw new Error(`Gateway [${loyaltySettings.gateway_type}] não configurado para esta empresa.`)
        }

        const gatewayConfig = gateway.config
        const isSandbox = gateway.is_sandbox !== false

        // 5. Contact Management
        let realContactId = contactId
        let finalContactData = customer

        if (contactId) {
            const { data: dbContact, error: dbContactError } = await supabaseAdmin
                .from('contacts')
                .select('*')
                .eq('id', contactId)
                .single()
            
            if (dbContactError || !dbContact) throw new Error('Contato não encontrado no banco de dados.')
            
            finalContactData = {
                name: dbContact.name,
                email: dbContact.email,
                phone: dbContact.whatsapp || dbContact.phone || '',
                document: dbContact.cnpj || dbContact.cpf || dbContact.tax_id || ''
            }
        } else {
            const documentClean = customer.document.replace(/\D/g, '')
            const { data: contacts } = await supabaseAdmin
                .from('contacts')
                .select('id')
                .eq('company_id', companyId)
                .or(`cpf.eq.${documentClean},cnpj.eq.${documentClean}`)
                .limit(1)

            if (contacts && contacts.length > 0) {
                realContactId = contacts[0].id
            } else {
                const { data: newContact, error: createContactError } = await supabaseAdmin
                    .from('contacts')
                    .insert([{
                        company_id: companyId,
                        name: customer.name,
                        email: customer.email,
                        phone: customer.phone.replace(/\D/g, ''),
                        cpf: documentClean.length === 11 ? documentClean : null,
                        cnpj: documentClean.length > 11 ? documentClean : null,
                        type: 'lead'
                    }])
                    .select()
                    .single()
                if (createContactError) throw createContactError
                realContactId = newContact.id
            }
        }

        // 6. Register/Update Subscription (Atomic RPC)
        const portalToken = crypto.randomUUID()
        const nextBilling = new Date()
        // nextBilling.setMonth(nextBilling.getMonth() + 1) // Remove this to charge TODAY
        const nextDueStr = nextBilling.toISOString().split('T')[0]

        console.log('[Loyalty] Executing atomic upsert for contact:', realContactId)
        const { data: subscription, error: subError } = await supabaseAdmin
            .rpc('upsert_loyalty_subscription', {
                p_company_id: companyId,
                p_contact_id: realContactId,
                p_plan_id: planId,
                p_status: 'pending',
                p_portal_token: portalToken,
                p_next_due_at: nextDueStr
            })
            .single()

        if (subError) throw subError

        // 7. Generate Gateway Payment
        let checkoutUrl = ''
        let gatewaySubId = ''
        const docClean = (finalContactData.document || '').replace(/\D/g, '')

        if (loyaltySettings.gateway_type === 'asaas') {
            const apiKey = gatewayConfig[`${isSandbox ? 'sandbox_' : 'prod_'}api_key`] || gatewayConfig.api_key
            const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'

            if (!apiKey) throw new Error(`API Key do Asaas [${isSandbox ? 'sandbox' : 'produção'}] não encontrada.`)

            // a. Find or Create Asaas Customer
            let asaasCustomerId = ''
            const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${docClean}`, {
                headers: { 'access_token': apiKey }
            })
            const searchData = await searchRes.json()

            if (searchData.data && searchData.data.length > 0) {
                asaasCustomerId = searchData.data[0].id
            } else {
                const createRes = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: finalContactData.name,
                        cpfCnpj: docClean,
                        email: finalContactData.email || '',
                        mobilePhone: finalContactData.phone || ''
                    })
                })
                const createData = await createRes.json()
                if (createData.errors) throw new Error(`Asaas Customer Error: ${createData.errors[0].description}`)
                asaasCustomerId = createData.id
            }

            // b. Create Subscription
            const asaasSubRes = await fetch(`${baseUrl}/subscriptions`, {
                method: 'POST',
                headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer: asaasCustomerId,
                    billingType: 'UNDEFINED',
                    value: plan.price,
                    nextDueDate: nextBilling.toISOString().split('T')[0],
                    cycle: plan.billing_cycle === 'yearly' ? 'YEARLY' : 'MONTHLY',
                    description: `Clube VIP: ${plan.name}`,
                    externalReference: subscription.id,
                    notificationDisabled: true // We manually send the email if enabled
                })
            })
            const asaasSubData = await asaasSubRes.json()
            if (asaasSubData.errors) throw new Error(`Asaas Sub Error: ${asaasSubData.errors[0].description}`)
            
            gatewaySubId = asaasSubData.id
            // Prefer checkoutUrl if provided, otherwise we'll fetch the first payment link
            checkoutUrl = asaasSubData.checkoutUrl || ''

            // ALWAYS try to fetch the first payment's public link for better delivery
            if (gatewaySubId) {
                const paymentsRes = await fetch(`${baseUrl}/subscriptions/${gatewaySubId}/payments`, {
                    headers: { 'access_token': apiKey }
                })
                const paymentsData = await paymentsRes.json()
                if (paymentsData.data && paymentsData.data.length > 0) {
                    // invoiceUrl is the public link (.../i/...)
                    checkoutUrl = paymentsData.data[0].invoiceUrl || paymentsData.data[0].bankSlipUrl || checkoutUrl
                }
            }
        }

        if (!checkoutUrl) {
            throw new Error('Assinatura criada, mas o gateway não retornou um link de pagamento direto.')
        }

        // 8. Update local subscription
        await supabaseAdmin.from('loyalty_subscriptions').update({
            gateway_sub_id: gatewaySubId,
            status: 'pending'
        }).eq('id', subscription.id)

        // 9. BACKGROUND NOTIFICATIONS
        let whatsappSent = false
        const firstName = finalContactData.name.split(' ')[0]
        const formattedPrice = Number(plan.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

        // 9.1 WhatsApp
        if (appSettings.loyalty_whatsapp_enabled && finalContactData.phone) {
            const evoUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
            const evoKey = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'
            
            // Try to find a connected instance for this company
            let instanceName = appSettings.platform_whatsapp_instance || 'MainAdmin'
            const { data: instances } = await supabaseAdmin
                .from('instances')
                .select('instance_name')
                .eq('company_id', companyId)
                .eq('status', 'connected')
                .limit(1)
            
            if (instances && instances.length > 0) {
                instanceName = instances[0].instance_name
            }

            console.log(`[Loyalty] Notification attempt: ${finalContactData.phone} via ${instanceName}`)

            const template = appSettings.loyalty_whatsapp_template || 'Olá, {name}! 👋 Seu link para ativar o {plan_name} no Clube VIP está pronto: {payment_link}'
            const message = template
                .replace(/{name}/g, firstName)
                .replace(/{plan_name}/g, plan.name)
                .replace(/{payment_link}/g, checkoutUrl)
                .replace(/{price}/g, formattedPrice)

            let cleanPhone = finalContactData.phone.replace(/\D/g, '')
            if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith('55')) {
                cleanPhone = '55' + cleanPhone
            }

            if (cleanPhone.length >= 10) {
                try {
                    whatsappSent = await sendWhatsApp(instanceName, cleanPhone, message, evoKey, evoUrl)
                    console.log(`[Loyalty] WhatsApp Result: ${whatsappSent ? 'SUCCESS' : 'FAILURE'}`)
                } catch (err: any) {
                    console.error('[Loyalty] WhatsApp Error:', err.message)
                }
            } else {
                console.warn(`[Loyalty] Phone number too short: ${cleanPhone}`)
            }
        } else {
            console.log('[Loyalty] WhatsApp skipped:', {
                enabled: appSettings?.loyalty_whatsapp_enabled,
                hasPhone: !!finalContactData?.phone
            })
        }

        // 9.2 Custom HTML Email
        let emailSent = false
        if (appSettings.loyalty_email_enabled && finalContactData.email && resendKey) {
            const template = appSettings.loyalty_email_template || `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h1 style="color: #6366f1; text-align: center;">Seu Link VIP está pronto!</h1>
                    <p>Olá, <strong>{name}</strong>,</p>
                    <p>Prepare-se para aproveitar as vantagens exclusivas do <strong>{plan_name}</strong> no nosso Clube VIP.</p>
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Plano:</strong> {plan_name}</p>
                        <p style="margin: 5px 0;"><strong>Valor:</strong> R$ {price}</p>
                    </div>
                    <p style="text-align: center; margin-top: 30px;">
                        <a href="{payment_link}" style="background-color: #6366f1; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Ativar Agora</a>
                    </p>
                    <p style="font-size: 12px; color: #666; text-align: center; margin-top: 30px;">Se o botão não funcionar, copie este link: {payment_link}</p>
                </div>
            `
            const html = template
                .replace(/{name}/g, firstName)
                .replace(/{plan_name}/g, plan.name)
                .replace(/{payment_link}/g, checkoutUrl)
                .replace(/{price}/g, formattedPrice)

            emailSent = await sendEmail(
                finalContactData.email,
                `Seu Link VIP: ${plan.name}`,
                html,
                resendKey
            )
        }

        return new Response(JSON.stringify({ 
            success: true, 
            checkout_url: checkoutUrl, 
            subscription_id: subscription.id,
            whatsapp_sent: whatsappSent,
            email_sent: emailSent
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('Loyalty Checkout Error:', error.message)
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }
})
