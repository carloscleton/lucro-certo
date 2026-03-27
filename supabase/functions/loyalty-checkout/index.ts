import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sendWhatsApp(instanceName: string, targetNumber: string, text: string, apiKey: string, baseUrl: string) {
    try {
        const response = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify({
                number: targetNumber,
                options: { delay: 1200, presence: "composing" },
                textMessage: { text }
            })
        })
        return response.ok
    } catch (e) {
        console.error('Error sending WhatsApp:', e)
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
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

        // 1. Get Request body
        const { planId, customer, contactId } = await req.json()
        if (!planId || (!customer && !contactId)) {
            throw new Error('Missing planId, customer or contactId')
        }

        // 1.1 Fetch App Settings (for global templates and keys)
        const { data: appSettings } = await supabaseAdmin.from('app_settings').select('*').eq('id', 1).single()
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

        // 6. Register Subscription
        const portalToken = crypto.randomUUID()
        const nextBilling = new Date()
        nextBilling.setMonth(nextBilling.getMonth() + 1)

        const { data: subscription, error: subError } = await supabaseAdmin
            .from('loyalty_subscriptions')
            .insert([{
                company_id: companyId,
                plan_id: planId,
                contact_id: realContactId,
                status: 'pending',
                portal_token: portalToken,
                next_due_at: nextBilling.toISOString().split('T')[0]
            }])
            .select()
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
                    notificationDisabled: !appSettings.loyalty_email_enabled
                })
            })
            const asaasSubData = await asaasSubRes.json()
            if (asaasSubData.errors) throw new Error(`Asaas Sub Error: ${asaasSubData.errors[0].description}`)
            
            checkoutUrl = asaasSubData.checkoutUrl || asaasSubData.invoiceUrl || ''
            gatewaySubId = asaasSubData.id

            if (!checkoutUrl && gatewaySubId) {
                const paymentsRes = await fetch(`${baseUrl}/subscriptions/${gatewaySubId}/payments`, {
                    headers: { 'access_token': apiKey }
                })
                const paymentsData = await paymentsRes.json()
                if (paymentsData.data && paymentsData.data.length > 0) {
                    checkoutUrl = paymentsData.data[0].invoiceUrl || paymentsData.data[0].bankSlipUrl
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

        // 9. BACKGROUND NOTIFICATION
        let whatsappSent = false
        if (appSettings.loyalty_whatsapp_enabled && finalContactData.phone) {
            const evoUrl = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
            const evoKey = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'
            const instanceName = appSettings.platform_whatsapp_instance || 'MainAdmin'
            
            const template = appSettings.loyalty_whatsapp_template || 'Olá, {name}! 👋 Seu link para ativar o {plan_name} no Clube VIP está pronto: {payment_link}'
            const message = template
                .replace(/{name}/g, finalContactData.name.split(' ')[0])
                .replace(/{plan_name}/g, plan.name)
                .replace(/{payment_link}/g, checkoutUrl)

            let cleanPhone = finalContactData.phone.replace(/\D/g, '')
            if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith('55')) {
                cleanPhone = '55' + cleanPhone
            }

            if (cleanPhone.length >= 10) {
                whatsappSent = await sendWhatsApp(instanceName, cleanPhone, message, evoKey, evoUrl)
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            checkout_url: checkoutUrl, 
            subscription_id: subscription.id,
            whatsapp_sent: whatsappSent,
            email_sent: appSettings.loyalty_email_enabled && !!finalContactData.email
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
