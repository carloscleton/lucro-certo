import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Verifying Auth
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { company_id } = await req.json()

        // Admin Auth (Elevated client)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Ensure user belongs to company
        const { data: membership } = await supabaseAdmin
            .from('company_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('company_id', company_id)
            .single()

        if (!membership) throw new Error('Not a member of this company')

        // 1. Fetch Company Info
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('id', company_id)
            .single()

        if (!company) throw new Error('Company not found')

        // 2. Fetch App Settings for Platform Gateway
        const { data: settings } = await supabaseAdmin
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single()

        const provider = settings.platform_billing_provider || 'asaas'
        const isSandbox = settings.platform_billing_sandbox !== false
        const amount = company.next_billing_value || 97.00

        let checkoutUrl = '';

        if (provider === 'asaas') {
            const apiKey = settings.platform_asaas_api_key
            if (!apiKey) throw new Error('Asaas API Key not configured on platform')
            const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'

            // a. Find or Create Asaas Customer
            const cpfCnpj = company.cnpj || company.document || '00000000000'
            let customerId = ''

            // Search customer by CPF/CNPJ
            const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cpfCnpj.replace(/\D/g, '')}`, {
                headers: { 'access_token': apiKey }
            })
            const searchData = await searchRes.json()

            if (searchData.data && searchData.data.length > 0) {
                customerId = searchData.data[0].id
            } else {
                // Create customer
                const createRes = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: company.trade_name || 'Lucro Certo Customer',
                        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
                        email: (user as any).email,
                        mobilePhone: company.phone || ''
                    })
                })
                const createData = await createRes.json()
                if (createData.errors) throw new Error(`Asaas Customer Error: ${createData.errors[0].description}`)
                customerId = createData.id
            }

            // b. Create Charge (Boleto/PIX/Card)
            // Asaas allows setting billingType = 'UNDEFINED' so the user chooses on the Asaas checkout page
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + 3) // 3 days to pay

            const chargePayload: any = {
                customer: customerId,
                billingType: 'UNDEFINED',
                value: amount,
                dueDate: dueDate.toISOString().split('T')[0],
                description: `Assinatura Lucro Certo - ${company.trade_name}`,
                externalReference: company.id
            }

            // Add walletId if split is configured
            if (settings.platform_asaas_wallet_id) {
                chargePayload.split = [{
                    walletId: settings.platform_asaas_wallet_id,
                    fixedValue: amount,
                    status: 'PENDING'
                }]
            }

            const chargeRes = await fetch(`${baseUrl}/payments`, {
                method: 'POST',
                headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify(chargePayload)
            })
            const chargeData = await chargeRes.json()
            if (chargeData.errors) throw new Error(`Asaas Charge Error: ${chargeData.errors[0].description}`)

            // chargeData.invoiceUrl -> link to Asaas checkout
            checkoutUrl = chargeData.invoiceUrl
        } else if (provider === 'mercadopago') {
            // Mock integration, requires MP Preference Create
            throw new Error('Mercado Pago integration not yet fully implemented in this module.')
        } else {
            // Stripe
            throw new Error('Stripe integration not yet fully implemented in this module.')
        }

        return new Response(JSON.stringify({ paymentUrl: checkoutUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
