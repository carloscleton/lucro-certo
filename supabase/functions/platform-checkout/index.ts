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

        let provider = settings.platform_billing_provider
        let configData: any = {}
        let env = 'production'
        let isSandbox = false

        if (provider) {
            isSandbox = settings.platform_billing_sandbox !== false
            env = isSandbox ? 'sandbox' : 'production'
            configData = settings.platform_billing_config?.[provider]?.[env] || {}
        } else {
            // Tenta pegar o gateway da empresa master se nao houver plataforma setada no settings globais
            const masterCompanyId = 1; // Ajuste se necessario, 1 e o ID master
            const { data: gateways } = await supabaseAdmin
                .from('company_payment_gateways')
                .select('*')
                .eq('company_id', masterCompanyId)
                .eq('is_active', true)
                .limit(1)

            if (gateways && gateways.length > 0) {
                provider = gateways[0].provider
                configData = gateways[0].config
                isSandbox = gateways[0].is_sandbox !== false
                env = isSandbox ? 'sandbox' : 'production'
            } else {
                provider = 'asaas' // Fallback to throw standard not configured error
            }
        }
        // Security: Get REAL amount from landing_plans to prevent tampering
        let amount = company.next_billing_value || 97.00
        if (settings.landing_plans && Array.isArray(settings.landing_plans)) {
            const planDetails = settings.landing_plans.find((p: any) => p.name === company.subscription_plan);
            if (planDetails && planDetails.price) {
                const realPrice = parseFloat(planDetails.price.toString().replace(/[^0-9.-]+/g, ""));
                if (!isNaN(realPrice) && realPrice > 0) {
                    amount = realPrice;
                    // Auto-correct company in background if wrong
                    if (company.next_billing_value !== amount) {
                        supabaseAdmin.from('companies').update({ next_billing_value: amount }).eq('id', company.id).then();
                    }
                }
            }
        }

        let checkoutUrl = '';

        if (provider === 'asaas') {
            const apiKey = configData.api_key
            if (!apiKey) throw new Error(`Asaas API Key [${env}] not configured on platform`)
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

            // b. Create Charge
            const dueDate = new Date()
            dueDate.setDate(dueDate.getDate() + 3)

            const chargePayload: any = {
                customer: customerId,
                billingType: 'UNDEFINED',
                value: amount,
                dueDate: dueDate.toISOString().split('T')[0],
                description: `Assinatura Lucro Certo - ${company.trade_name}`,
                externalReference: company.id
            }

            const walletId = configData.wallet_id || settings.platform_asaas_wallet_id
            if (walletId) {
                chargePayload.split = [{
                    walletId: walletId,
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

            checkoutUrl = chargeData.invoiceUrl
        } else if (provider === 'mercadopago') {
            const accessToken = configData.access_token
            if (!accessToken) throw new Error(`Mercado Pago Access Token [${env}] not configured`)

            // Create Preference
            const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: [{
                        title: `Assinatura Lucro Certo - ${company.trade_name}`,
                        quantity: 1,
                        unit_price: amount,
                        currency_id: 'BRL'
                    }],
                    external_reference: company.id,
                    back_urls: {
                        success: `${Deno.env.get('PUBLIC_URL') || 'https://lucrocerto.com'}/dashboard`,
                        pending: `${Deno.env.get('PUBLIC_URL') || 'https://lucrocerto.com'}/dashboard`,
                        failure: `${Deno.env.get('PUBLIC_URL') || 'https://lucrocerto.com'}/dashboard`
                    },
                    auto_return: 'all'
                })
            })
            const prefData = await prefRes.json()
            if (prefData.error) throw new Error(`Mercado Pago Error: ${prefData.message}`)
            checkoutUrl = isSandbox ? prefData.sandbox_init_point : prefData.init_point
        } else if (provider === 'stripe') {
            const secretKey = configData.secret_key
            if (!secretKey) throw new Error(`Stripe Secret Key [${env}] not configured`)

            const { default: Stripe } = await import('https://esm.sh/stripe@13.10.0?target=deno')
            const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'brl',
                        product_data: { name: `Assinatura Lucro Certo - ${company.trade_name}` },
                        unit_amount: Math.round(amount * 100),
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${Deno.env.get('PUBLIC_URL') || 'https://lucrocerto.com'}/dashboard?status=success`,
                cancel_url: `${Deno.env.get('PUBLIC_URL') || 'https://lucrocerto.com'}/dashboard?status=cancelled`,
                metadata: { external_reference: company.id }
            })

            checkoutUrl = session.url
        } else {
            throw new Error(`Provider ${provider} not supported for platform billing.`)
        }

        return new Response(JSON.stringify({ paymentUrl: checkoutUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        console.error('Platform Checkout Error:', error.message)
        const isAuthError = error.message === 'Unauthorized' || error.message.includes('Not a member')
        return new Response(JSON.stringify({ error: error.message }), {
            status: isAuthError ? 401 : 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
