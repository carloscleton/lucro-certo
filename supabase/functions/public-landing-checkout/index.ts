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
        const { plan_name, price } = await req.json()

        // Validate
        if (!plan_name || !price) {
            throw new Error('Name and price are required')
        }

        // Admin Auth (Elevated client)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

        // 1. Fetch App Settings for Platform Gateway
        const { data: settings } = await supabaseAdmin
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single()

        let provider = settings?.platform_billing_provider
        let configData: any = {}
        let env = 'production'

        if (provider) {
            const isSandbox = settings?.platform_billing_sandbox !== false
            env = isSandbox ? 'sandbox' : 'production'
            configData = settings?.platform_billing_config?.[provider]?.[env] || {}
        } else {
            // Tenta pegar o gateway da empresa master se nao houver plataforma
            const masterCompanyId = 1; // Ajuste se necessario
            const { data: gateways } = await supabaseAdmin
                .from('company_payment_gateways')
                .select('*')
                .eq('company_id', masterCompanyId)
                .eq('is_active', true)
                .limit(1)

            if (gateways && gateways.length > 0) {
                provider = gateways[0].provider
                configData = gateways[0].config
                const isSandbox = gateways[0].is_sandbox !== false
                env = isSandbox ? 'sandbox' : 'production'
            } else {
                throw new Error('Nenhum gateway configurado na plataforma ou na empresa Master.')
            }
        }

        const numericPrice = parseFloat(price.toString().replace(/[^0-9.-]+/g, "")) || 0
        let paymentUrl = '';
        const publicUrl = Deno.env.get('PUBLIC_URL') || 'https://lucrocerto.com'

        if (provider === 'asaas') {
            const apiKey = configData.api_key
            if (!apiKey) throw new Error(`Asaas API Key não configurada`)
            const baseUrl = env === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'

            const chargeRes = await fetch(`${baseUrl}/paymentLinks`, {
                method: 'POST',
                headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    billingType: 'UNDEFINED',
                    chargeType: 'DETACHED',
                    name: `Assinatura Plano ${plan_name}`,
                    description: `Acesso ao Lucro Certo - Plano ${plan_name}`,
                    value: numericPrice,
                    dueDateLimitDays: 3,
                })
            })
            const chargeData = await chargeRes.json()
            if (chargeData.errors) throw new Error(`Asaas Link Error: ${chargeData.errors[0].description}`)

            paymentUrl = chargeData.url

        } else if (provider === 'mercadopago') {
            const accessToken = configData.access_token
            if (!accessToken) throw new Error(`Mercado Pago Access Token não configurado`)

            const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: [{
                        title: `Plano ${plan_name} - Lucro Certo`,
                        quantity: 1,
                        unit_price: numericPrice,
                        currency_id: 'BRL'
                    }],
                    back_urls: {
                        success: `${publicUrl}/login?mode=signup`,
                        pending: `${publicUrl}/login?mode=signup`,
                        failure: `${publicUrl}/`
                    },
                    auto_return: 'all'
                })
            })
            const prefData = await prefRes.json()
            if (prefData.error || prefData.message) throw new Error(`Mercado Pago Error: ${prefData.message}`)
            paymentUrl = env === 'sandbox' ? prefData.sandbox_init_point : prefData.init_point

        } else if (provider === 'stripe') {
            const secretKey = configData.secret_key
            if (!secretKey) throw new Error(`Stripe Secret Key não configurada`)

            const { default: Stripe } = await import('https://esm.sh/stripe@13.10.0?target=deno')
            const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16', httpClient: Stripe.createFetchHttpClient() })

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'brl',
                        product_data: { name: `Assinatura Plano ${plan_name}` },
                        unit_amount: Math.round(numericPrice * 100),
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${publicUrl}/login?mode=signup`,
                cancel_url: `${publicUrl}/`
            })

            paymentUrl = session.url

        } else {
            throw new Error(`Gateway ${provider} não suportado pelo checkout dinâmico.`)
        }

        return new Response(JSON.stringify({ url: paymentUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
