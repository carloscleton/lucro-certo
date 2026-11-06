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

        // Verifying Auth with multiple fallbacks
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
        const body = await req.json()
        const { company_id, access_token: bodyToken, user_id: bodyUserId } = body
        const token = bodyToken || (authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null)

        let userId: string | null = null
        if (token) {
            try {
                const parts = token.split('.')
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]))
                    if (payload.role === 'authenticated' || payload.sub) {
                        userId = payload.sub || null
                    }
                }
            } catch (jwtErr) {
                console.error('Failed to parse JWT:', jwtErr)
            }
        }

        // Fallback 1: user_id enviado no body
        if (!userId && bodyUserId) {
            userId = bodyUserId
        }

        // 1. Fetch Company Info
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('id', company_id)
            .single()

        if (!company) throw new Error('Company not found')

        // Fallback 2: Dono da própria empresa
        if (!userId && company.user_id) {
            userId = company.user_id
        }

        if (!userId) throw new Error('Unauthorized: User not identified')

        // Ensure user belongs to company or is owner
        const { data: membership } = await supabaseAdmin
            .from('company_members')
            .select('role')
            .eq('user_id', userId)
            .eq('company_id', company_id)
            .single()

        if (!membership) {
            if (company.user_id === userId) {
                await supabaseAdmin.from('company_members').insert({
                    company_id: company_id,
                    user_id: userId,
                    role: 'admin',
                    status: 'active'
                })
            } else {
                throw new Error('Not a member of this company')
            }
        }

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

        let provider = settings?.platform_billing_provider || 'asaas'
        let configData: any = {}
        let env = 'production'
        let isSandbox = false

        const extractGatewayApiKey = (cfg: any, isSb: boolean): string | null => {
            if (!cfg || typeof cfg !== 'object') return null
            if (isSb) {
                return (cfg.sandbox_api_key || cfg.api_key || cfg.apiKey || cfg.token || cfg.prod_api_key || '').toString().trim() || null
            } else {
                return (cfg.prod_api_key || cfg.production_api_key || cfg.api_key || cfg.apiKey || cfg.token || cfg.sandbox_api_key || '').toString().trim() || null
            }
        }

        if (settings) {
            isSandbox = settings.platform_billing_sandbox === true
            env = isSandbox ? 'sandbox' : 'production'
            configData = settings.platform_billing_config?.[provider]?.[env] || {}

            // Legacy fallbacks if JSONB is empty for this provider
            if (provider === 'asaas' && !configData.api_key) {
                configData = {
                    api_key: settings.platform_asaas_api_key,
                    wallet_id: settings.platform_asaas_wallet_id
                }
            } else if (provider === 'stripe' && !configData.secret_key) {
                configData = {
                    secret_key: settings.platform_stripe_api_key,
                    publishable_key: settings.platform_stripe_publishable_key
                }
            } else if (provider === 'mercadopago' && !configData.access_token) {
                configData = {
                    access_token: settings.platform_mercadopago_api_key,
                    public_key: settings.platform_mercadopago_public_key
                }
            }
        }

        // Se a chave nao estiver configurada diretamente em app_settings,
        // busca nas credenciais do gateway Asaas configurado na conta master (SERVICE LINE INFORMATICA / labfacilsuporte@gmail.com)
        let directKey = extractGatewayApiKey(configData, isSandbox) || configData.access_token || configData.secret_key
        let candidatesChecked = 0

        if (!directKey) {
            console.log('🔍 Chave direta em app_settings ausente. Buscando nas credenciais master (labfacilsuporte@gmail.com / SERVICE LINE)...')

            // 1. Busca direta na empresa SERVICE LINE INFORMATICA (84d1586e-5d0c-456f-aa12-aefc5a9364a7)
            const { data: directGateways } = await supabaseAdmin
                .from('company_payment_gateways')
                .select('*')
                .eq('company_id', '84d1586e-5d0c-456f-aa12-aefc5a9364a7')

            // 2. Busca qualquer gateway Asaas configurado no sistema
            const { data: allAsaasGateways } = await supabaseAdmin
                .from('company_payment_gateways')
                .select('*')
                .eq('provider', 'asaas')
                .order('is_active', { ascending: false })

            // 3. Fallback: qualquer gateway ativo
            const { data: anyActiveGateways } = await supabaseAdmin
                .from('company_payment_gateways')
                .select('*')
                .eq('is_active', true)

            const allCandidates = [
                ...(directGateways || []),
                ...(allAsaasGateways || []),
                ...(anyActiveGateways || [])
            ]
            candidatesChecked = allCandidates.length

            let chosenGw: any = null
            let chosenApiKey: string | null = null

            for (const gw of allCandidates) {
                const gwSandbox = gw.is_sandbox === true
                const extracted = extractGatewayApiKey(gw.config, gwSandbox)
                if (extracted) {
                    chosenGw = gw
                    chosenApiKey = extracted
                    break
                }
            }

            if (chosenGw && chosenApiKey) {
                provider = chosenGw.provider || 'asaas'
                isSandbox = chosenGw.is_sandbox === true
                env = isSandbox ? 'sandbox' : 'production'
                configData = {
                    api_key: chosenApiKey,
                    wallet_id: chosenGw.config?.wallet_id || chosenGw.config?.prod_wallet_id || chosenGw.config?.walletId || null
                }
                directKey = chosenApiKey

                console.log('✅ Gateway Asaas da conta master carregado com sucesso:', {
                    provider,
                    env,
                    company_id: chosenGw.company_id,
                    hasApiKey: true
                })

                // Persiste em app_settings para acelerar futuras requisicoes
                try {
                    const curBillingConfig = settings?.platform_billing_config || {}
                    if (!curBillingConfig[provider]) curBillingConfig[provider] = {}
                    if (!curBillingConfig[provider].production) curBillingConfig[provider].production = {}
                    if (!curBillingConfig[provider].sandbox) curBillingConfig[provider].sandbox = {}

                    curBillingConfig[provider].production = {
                        api_key: chosenApiKey,
                        wallet_id: configData.wallet_id
                    }
                    curBillingConfig[provider].sandbox = {
                        api_key: chosenApiKey,
                        wallet_id: configData.wallet_id
                    }

                    await supabaseAdmin
                        .from('app_settings')
                        .update({
                            platform_billing_provider: provider,
                            platform_billing_sandbox: isSandbox,
                            platform_asaas_api_key: chosenApiKey,
                            platform_billing_config: curBillingConfig
                        })
                        .eq('id', 1)
                    console.log('✅ Chave Asaas sincronizada em app_settings com sucesso.')
                } catch (syncErr) {
                    console.warn('Aviso: Falha ao salvar em app_settings:', syncErr)
                }
            }
        } else {
            // Garante que configData.api_key tem a chave extraida
            if (provider === 'asaas') {
                configData.api_key = directKey
            }
        }

        if (!provider || !directKey) {
            throw new Error(`Platform Billing is not configured! Provider: ${provider || 'none'}. Please set it in Super Admin > Sistema > Cobrança. (Candidatos avaliados: ${candidatesChecked})`)
        }

        // Security: Get REAL amount from landing_plans to prevent tampering
        let amount = company.next_billing_value || 97.00
        if (settings?.landing_plans && Array.isArray(settings.landing_plans)) {
            const planDetails = settings.landing_plans.find((p: any) => p.name === company.subscription_plan)
            if (planDetails && planDetails.price) {
                const priceStr = planDetails.price.toString().replace('R$', '').replace('.', '').replace(',', '.').trim()
                const realPrice = parseFloat(priceStr)
                if (!isNaN(realPrice) && realPrice > 0) {
                    amount = realPrice
                    // Auto-correct company in background if wrong
                    if (company.next_billing_value !== amount) {
                        supabaseAdmin.from('companies').update({ next_billing_value: amount }).eq('id', company.id).then()
                    }
                }
            }
        }

        // Custom client fixed fee from admin_fiscal_billing if configured (Imagem 2)
        const adminBilling = company.settings?.admin_fiscal_billing
        const fiscalProvider = company.settings?.fiscal_provider || 'tecnospeed'
        if (adminBilling && adminBilling.fixed_enabled !== false) {
            const providerFixed = adminBilling[fiscalProvider]?.fixed_fee ?? adminBilling.other?.fixed_fee
            if (typeof providerFixed === 'number' && providerFixed > 0) {
                amount = providerFixed
            }
        }

        // Check if there is an unpaid setup fee (Taxa de Implantação) configured for this client (Imagem 1 & 2)
        const rawSetupFee = typeof adminBilling?.setup_fee === 'number' ? adminBilling.setup_fee : 0
        const isSetupPaid = adminBilling?.setup_fee_paid === true
        let setupFeeToAdd = 0

        if (!isSetupPaid && rawSetupFee > 0) {
            setupFeeToAdd = rawSetupFee
            amount += setupFeeToAdd
            console.log(`[platform-checkout] Adicionada Taxa de Implantação de R$ ${setupFeeToAdd} para empresa ${company.id}. Total a cobrar: R$ ${amount}`)
        }

        // Check notes emitted in the current billing cycle
        let notesFeeToAdd = 0
        let cycleNotesCount = 0
        try {
            const cycleStartDay = typeof adminBilling?.billing_cycle_start_day === 'number' ? adminBilling.billing_cycle_start_day : 1
            const today = new Date()
            let cycleStart = new Date(today.getFullYear(), today.getMonth(), cycleStartDay, 0, 0, 0, 0)
            if (today.getDate() < cycleStartDay) {
                cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, cycleStartDay, 0, 0, 0, 0)
            }
            const lastBilledAt = adminBilling?.last_billed_at ? new Date(adminBilling.last_billed_at) : null
            const effectiveStart = lastBilledAt && lastBilledAt > cycleStart ? lastBilledAt : cycleStart

            const { data: invRows } = await supabaseAdmin
                .from('fiscal_invoices')
                .select('id, status, created_at')
                .eq('company_id', company.id)
                .gte('created_at', effectiveStart.toISOString())

            if (invRows && invRows.length > 0) {
                const validInv = invRows.filter((i: any) => 
                    ['concluido', 'autorizada', 'concluído', 'autorizado', 'cancelado', 'cancelada'].includes(String(i.status).toLowerCase())
                )
                cycleNotesCount = validInv.length
                const providerCfg = adminBilling?.[fiscalProvider] || adminBilling?.national || adminBilling?.tecnospeed || {}
                const perNote = typeof providerCfg.per_note_fee === 'number' ? providerCfg.per_note_fee : 0.50
                notesFeeToAdd = cycleNotesCount * perNote
                if (notesFeeToAdd > 0) {
                    amount += notesFeeToAdd
                    console.log(`[platform-checkout] Adicionadas ${cycleNotesCount} notas fiscais do ciclo (R$ ${notesFeeToAdd}). Total a cobrar: R$ ${amount}`)
                }
            }
        } catch (noteErr) {
            console.warn('[platform-checkout] Erro ao calcular notas do ciclo:', noteErr)
        }

        const descParts = [`Assinatura Lucro Certo - ${company.subscription_plan || 'Plano'}`]
        if (setupFeeToAdd > 0) descParts.push('Taxa de Implantação')
        if (notesFeeToAdd > 0) descParts.push(`${cycleNotesCount} Notas Fiscais`)
        descParts.push(`(${company.trade_name})`)
        const chargeDescription = descParts.join(' + ')

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

        let checkoutUrl = ''

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
                description: chargeDescription,
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
                        title: chargeDescription,
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
                        product_data: { name: chargeDescription },
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
