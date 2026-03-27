import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

        // 2. Fetch Plan + Company + Loyalty Settings
        const { data: plan, error: planError } = await supabaseAdmin
            .from('loyalty_plans')
            .select('*, company:companies(id, trade_name, email, phone)')
            .eq('id', planId)
            .single()

        if (planError || !plan) throw new Error('Plano não encontrado.')

        const companyId = plan.company_id
        const { data: settings, error: settingsError } = await supabaseAdmin
            .from('loyalty_settings')
            .select('*')
            .eq('company_id', companyId)
            .single()

        if (settingsError || !settings) throw new Error('Configurações de fidelidade não encontradas.')

        // 3. Fetch Gateway Credentials
        const { data: gateway, error: gatewayError } = await supabaseAdmin
            .from('company_payment_gateways')
            .select('*')
            .eq('company_id', companyId)
            .eq('provider', settings.gateway_type)
            .eq('is_active', true)
            .single()

        if (gatewayError || !gateway) {
            throw new Error(`Gateway [${settings.gateway_type}] não configurado para esta empresa.`)
        }

        const gatewayConfig = gateway.config
        const isSandbox = gateway.is_sandbox !== false // Defaults to sandbox unless explicitly set

        // 4. Contact Management
        let realContactId = contactId
        let contactData = customer

        if (contactId) {
            const { data: dbContact, error: dbContactError } = await supabaseAdmin
                .from('contacts')
                .select('*')
                .eq('id', contactId)
                .single()
            
            if (dbContactError || !dbContact) throw new Error('Contato não encontrado no banco de dados.')
            
            contactData = {
                name: dbContact.name,
                email: dbContact.email,
                phone: dbContact.whatsapp || dbContact.phone || '',
                document: dbContact.cnpj || dbContact.cpf || dbContact.tax_id || ''
            }
        } else {
            // Upsert Logic for public checkout
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

        // 5. Register Subscription
        const portalToken = crypto.randomUUID()
        const nextBilling = new Date()
        nextBilling.setMonth(nextBilling.getMonth() + 1)

        const { data: subscription, error: subError } = await supabaseAdmin
            .from('loyalty_subscriptions')
            .insert([{
                company_id: companyId,
                plan_id: planId,
                contact_id: realContactId,
                status: 'active',
                portal_token: portalToken,
                next_billing_date: nextBilling.toISOString()
            }])
            .select()
            .single()

        if (subError) throw subError

        // 6. Generate Gateway Payment
        let checkoutUrl = ''
        let gatewaySubId = ''
        const documentClean = contactData.document.replace(/\D/g, '')

        if (settings.gateway_type === 'asaas') {
            const apiKey = gatewayConfig.api_key
            const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.api.asaas.com/v3'

            // a. Find or Create Asaas Customer
            const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${documentClean}`, { headers: { 'access_token': apiKey } })
            const searchData = await searchRes.json()
            
            let asaasCustomerId = ''
            if (searchData.data && searchData.data.length > 0) {
                asaasCustomerId = searchData.data[0].id
            } else {
                const createCustRes = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: contactData.name,
                        cpfCnpj: documentClean,
                        email: contactData.email || '',
                        mobilePhone: contactData.phone ? contactData.phone.replace(/\D/g, '') : ''
                    })
                })
                const createCustData = await createCustRes.json()
                if (createCustData.errors) throw new Error(`Asaas Cust Error: ${createCustData.errors[0].description}`)
                asaasCustomerId = createCustData.id
            }

            // b. Create Subscription in Asaas
            const asaasSubRes = await fetch(`${baseUrl}/subscriptions`, {
                method: 'POST',
                headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer: asaasCustomerId,
                    billingType: 'UNDEFINED',
                    value: plan.price,
                    nextDueDate: new Date().toISOString().split('T')[0],
                    cycle: plan.billing_cycle === 'monthly' ? 'MONTHLY' : 'YEARLY',
                    description: `Assinatura ${plan.name} - ${plan.company.trade_name}`,
                    externalReference: subscription.id
                })
            })
            const asaasSubData = await asaasSubRes.json()
            if (asaasSubData.errors) throw new Error(`Asaas Sub Error: ${asaasSubData.errors[0].description}`)
            
            checkoutUrl = asaasSubData.checkoutUrl || `${asaasSubData.invoiceUrl}` || ''
            gatewaySubId = asaasSubData.id
        } else {
            throw new Error(`Gateway ${settings.gateway_type} não suportado ainda para assinaturas automáticas.`)
        }

        // 7. Update Subscription with Gateway ID
        await supabaseAdmin
            .from('loyalty_subscriptions')
            .update({ gateway_subscription_id: gatewaySubId })
            .eq('id', subscription.id)

        // 8. Log the initial charge entry
        // In Asaas, creating a subscription might generate an invoice immediately.
        // We'll trust the Webhook to populate charges later, but let's return the URL.

        return new Response(JSON.stringify({ 
            success: true, 
            subscription_id: subscription.id, 
            checkout_url: checkoutUrl 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Loyalty Checkout Error:', error.message)
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 // Always 200 for handle properly in frontend error catch
        })
    }
})
