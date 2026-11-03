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
        // Admin client for elevated tasks
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Verifying Auth manually to bypass sync lag
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
        const { company_id, access_token: bodyToken } = await req.json()
        const token = bodyToken || authHeader?.replace('Bearer ', '')

        if (!token) throw new Error('Unauthorized: Missing Token')

        let userId: string | null = null
        try {
            const parts = token.split('.')
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]))
                userId = payload.sub
            }
        } catch (jwtErr) {
            console.error('Failed to parse JWT:', jwtErr)
        }

        if (!userId) throw new Error('Unauthorized: Invalid Token')

        // Ensure user belongs to company
        const { data: membership } = await supabaseAdmin
            .from('company_members')
            .select('role')
            .eq('user_id', userId)
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
        const { data: settings, error: settingsError } = await supabaseAdmin
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single()

        if (settingsError) console.error('Settings Fetch Error:', settingsError)
        console.log('App Settings Loaded:', {
            hasSettings: !!settings,
            provider: settings?.platform_billing_provider,
            sandbox: settings?.platform_billing_sandbox
        })

        let provider = settings?.platform_billing_provider || "asaas"
        let configData: any = {}
        let env = "production"
        let isSandbox = false

        if (settings) {
            isSandbox = settings.platform_billing_sandbox === true
            env = isSandbox ? "sandbox" : "production"
            configData = settings.platform_billing_config?.[provider]?.[env] || {}

            // Legacy fallbacks if JSONB is empty for this provider
            if (provider === "asaas" && !configData.api_key) {
                configData = {
                    api_key: settings.platform_asaas_api_key,
                    wallet_id: settings.platform_asaas_wallet_id
                }
            } else if (provider === "stripe" && !configData.secret_key) {
                configData = {
                    secret_key: settings.platform_stripe_api_key,
                    publishable_key: settings.platform_stripe_publishable_key
                }
            } else if (provider === "mercadopago" && !configData.access_token) {
                configData = {
                    access_token: settings.platform_mercadopago_api_key,
                    public_key: settings.platform_mercadopago_public_key
                }
            }
        }

        // Se a chave nao estiver configurada diretamente em app_settings,
        // busca as credenciais no gateway da conta Master (labfacilsuporte@gmail.com / carloscleton.nat@gmail.com / SERVICE LINE INFORMATICA)
        const hasDirectKey = !!(configData.api_key || configData.access_token || configData.secret_key);
        if (!hasDirectKey) {
            console.log("🔍 Chave direta em app_settings ausente. Buscando nas credenciais master (labfacilsuporte@gmail.com / SERVICE LINE)...");

            const masterEmails = ["labfacilsuporte@gmail.com", "carloscleton.nat@gmail.com"];
            const masterCompanyIds: string[] = [];

            // 1. Buscar empresas ligadas aos e-mails master
            for (const email of masterEmails) {
                const { data: adminProfiles } = await supabaseAdmin
                    .from("profiles")
                    .select("id")
                    .ilike("email", email.trim());

                if (adminProfiles && adminProfiles.length > 0) {
                    for (const prof of adminProfiles) {
                        const { data: adminMembers } = await supabaseAdmin
                            .from("company_members")
                            .select("company_id")
                            .eq("user_id", prof.id);

                        if (adminMembers && adminMembers.length > 0) {
                            for (const m of adminMembers) {
                                if (m.company_id && !masterCompanyIds.includes(m.company_id)) {
                                    masterCompanyIds.push(m.company_id);
                                }
                            }
                        }
                    }
                }
            }

            // 2. Buscar empresa SERVICE LINE INFORMATICA
            const { data: serviceLineComp } = await supabaseAdmin
                .from("companies")
                .select("id")
                .or("trade_name.ilike.%SERVICE LINE%,legal_name.ilike.%CARLOSCLETON%");

            if (serviceLineComp && serviceLineComp.length > 0) {
                for (const c of serviceLineComp) {
                    if (c.id && !masterCompanyIds.includes(c.id)) {
                        masterCompanyIds.push(c.id);
                    }
                }
            }

            // 3. Fallback: ID fixo conhecido da SERVICE LINE INFORMATICA
            if (!masterCompanyIds.includes("84d1586e-5d0c-456f-aa12-aefc5a9364a7")) {
                masterCompanyIds.push("84d1586e-5d0c-456f-aa12-aefc5a9364a7");
            }

            console.log("Empresas master identificadas para busca de gateway:", masterCompanyIds);

            let masterGateway: any = null;
            for (const compId of masterCompanyIds) {
                const { data: gateways } = await supabaseAdmin
                    .from("company_payment_gateways")
                    .select("*")
                    .eq("company_id", compId)
                    .order("is_default", { ascending: false });

                if (gateways && gateways.length > 0) {
                    const asaasGw = gateways.find((g: any) => g.provider === "asaas" && g.config?.api_key);
                    if (asaasGw) {
                        masterGateway = asaasGw;
                        break;
                    }
                    const anyValidGw = gateways.find((g: any) => g.config?.api_key || g.config?.access_token || g.config?.secret_key);
                    if (anyValidGw) {
                        masterGateway = anyValidGw;
                        break;
                    }
                }
            }

            // 4. Se ainda nao achou, busca qualquer gateway Asaas ativo na tabela inteira
            if (!masterGateway) {
                const { data: allAsaas } = await supabaseAdmin
                    .from("company_payment_gateways")
                    .select("*")
                    .eq("provider", "asaas")
                    .order("updated_at", { ascending: false })
                    .limit(5);

                const validAsaas = allAsaas?.find((g: any) => g.config?.api_key);
                if (validAsaas) {
                    masterGateway = validAsaas;
                }
            }

            if (masterGateway && masterGateway.config) {
                provider = masterGateway.provider || "asaas";
                configData = masterGateway.config;
                isSandbox = masterGateway.is_sandbox === true;
                env = isSandbox ? "sandbox" : "production";

                console.log("✅ Gateway da conta master (labfacilsuporte / SERVICE LINE) carregado com sucesso:", {
                    provider,
                    env,
                    company_id: masterGateway.company_id,
                    hasApiKey: !!(configData.api_key || configData.access_token || configData.secret_key)
                });

                // Persiste em app_settings para proximas chamadas
                try {
                    const curBillingConfig = settings?.platform_billing_config || {};
                    if (!curBillingConfig[provider]) curBillingConfig[provider] = {};
                    curBillingConfig[provider][env] = configData;

                    await supabaseAdmin
                        .from("app_settings")
                        .update({
                            platform_billing_provider: provider,
                            platform_billing_sandbox: isSandbox,
                            platform_billing_config: curBillingConfig
                        })
                        .eq("id", 1);
                    console.log("✅ Configuracao salva em app_settings permanentemente.");
                } catch (syncErr) {
                    console.warn("Aviso: Erro ao persistir app_settings:", syncErr);
                }
            }
        }

        if (!provider || !(configData.api_key || configData.access_token || configData.secret_key)) {
            throw new Error(`Platform Billing is not configured! Provider: ${provider || 'none'}. Please set it in Super Admin > Sistema > Cobrança.`)
        }

        // Security: Get REAL amount from landing_plans to prevent tampering
        let amount = company.next_billing_value || 97.00
        if (settings?.landing_plans && Array.isArray(settings.landing_plans)) {
            const planDetails = settings.landing_plans.find((p: any) => p.name === company.subscription_plan);
            if (planDetails && planDetails.price) {
                const priceStr = planDetails.price.toString().replace('R$', '').replace('.', '').replace(',', '.').trim();
                const realPrice = parseFloat(priceStr);
                if (!isNaN(realPrice) && realPrice > 0) {
                    amount = realPrice;
                    // Auto-correct company in background if wrong
                    if (company.next_billing_value !== amount) {
                        supabaseAdmin.from('companies').update({ next_billing_value: amount }).eq('id', company.id).then();
                    }
                }
            }
        }

        // 3. Proration Logic (Pro-rata)
        let discount = 0
        if (company.subscription_status === 'active' && company.current_period_end) {
            const now = new Date()
            const periodEnd = new Date(company.current_period_end)
            
            if (periodEnd > now) {
                const diffTime = periodEnd.getTime() - now.getTime()
                const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
                
                // If they have more than 1 day remaining, apply pro-rata discount
                if (daysRemaining > 1) {
                    const dailyRate = (company.next_billing_value || 0) / 30
                    discount = Math.floor(daysRemaining * dailyRate * 100) / 100
                    
                    console.log('Proration Applied:', {
                        daysRemaining,
                        dailyRate,
                        discount,
                        originalAmount: amount
                    })
                    
                    amount = Math.max(1, amount - discount) // Charge at least R$ 1.00 to avoid gateway errors
                }
            }
        }

        let checkoutUrl = '';

        if (provider === 'asaas') {
            const apiKey = configData.api_key
            if (!apiKey) throw new Error(`Asaas API Key [${env}] not configured on platform`)
            const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'

            // a. Find or Create Asaas Customer
            // PF: use 'cpf' field; PJ: use 'cnpj'; fallback to 'document' (old field)
            const rawCpfCnpj = company.cpf || company.cnpj || company.document || ''
            const cpfCnpj = rawCpfCnpj.replace(/\D/g, '')

            if (!cpfCnpj || cpfCnpj === '00000000000') {
                throw new Error('CPF/CNPJ não informado. Por favor, atualize seus dados antes de pagar.')
            }

            let customerId = ''

            // Search customer by CPF/CNPJ (already cleaned above)
            const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cpfCnpj}`, {
                headers: { 'access_token': apiKey }
            })
            const searchData = await searchRes.json()

            if (searchData.data && searchData.data.length > 0) {
                customerId = searchData.data[0].id
            } else {
                // Get user email from profile
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('email')
                    .eq('id', userId)
                    .single()

                // Create customer
                const createRes = await fetch(`${baseUrl}/customers`, {
                    method: 'POST',
                    headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: company.trade_name || 'Lucro Certo Customer',
                        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
                        email: profile?.email || '',
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
                        currency: (company.currency || 'brl').toLowerCase(),
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
        const msg = error.message || ''

        return new Response(JSON.stringify({ error: msg }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
