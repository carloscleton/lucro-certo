import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
    try {
        const payload = await req.json()
        const id = payload.data?.id || payload.id
        const type = payload.type || payload.topic

        console.log(`[MP Webhook] Received ${type} ID: ${id}`);

        if (type === 'payment' || type === 'payment.updated') {
            const { data: settings } = await supabase
                .from('app_settings')
                .select('platform_mercadopago_api_key')
                .eq('id', 1)
                .single()

            const accessToken = settings.platform_mercadopago_api_key
            if (!accessToken) throw new Error('MP Token not found')

            const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
            const payment = await mpRes.json()

            if (payment.status === 'approved') {
                const companyId = payment.external_reference
                if (companyId) {
                    console.log(`[MP Webhook] Activating Company: ${companyId}`);

                    let nextBillingDate = new Date();
                    const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single();

                    if (company?.current_period_end) {
                        const currentPeriod = new Date(company.current_period_end)
                        nextBillingDate = currentPeriod > nextBillingDate
                            ? new Date(currentPeriod.getTime() + (30 * 24 * 60 * 60 * 1000))
                            : new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
                    } else {
                        nextBillingDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
                    }

                    await supabase.from('companies').update({
                        subscription_status: 'active',
                        subscription_plan: 'pro',
                        current_period_end: nextBillingDate.toISOString(),
                    }).eq('id', companyId);

                    await supabase.from('company_charges').upsert({
                        company_id: companyId,
                        provider: 'mercadopago',
                        amount: payment.transaction_amount,
                        description: `Assinatura Lucro Certo - Pago MP #${payment.id}`,
                        external_reference: payment.id.toString(),
                        status: 'paid',
                        paid_at: new Date().toISOString()
                    }, { onConflict: 'external_reference' });
                }
            }
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 })
    } catch (err: any) {
        console.error('MP Webhook Error:', err.message)
        return new Response(JSON.stringify({ error: err.message }), { status: 400 })
    }
})
