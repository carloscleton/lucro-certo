import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
    try {
        // Validate webhook method
        if (req.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 })
        }

        const payload = await req.json()
        const event = payload.event
        const payment = payload.payment

        console.log(`[Asaas Webhook] Received Event: ${event} for Payment: ${payment?.id}`);

        if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
            const companyId = payment.externalReference

            if (!companyId) {
                console.warn('Webhook ignoring payment: No externalReference (companyId) found on payment.')
                return new Response('OK, but ignored (no external ref)', { status: 200 })
            }

            console.log(`[Asaas Webhook] Processing confirmation for Company: ${companyId}`);

            // 1. Fetch Company
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('*')
                .eq('id', companyId)
                .single()

            if (companyError || !company) {
                console.error(`Company not found for ID: ${companyId}`);
                return new Response('Company not found', { status: 404 })
            }

            // 2. Add 30 Days to Current Period End or current Date if trial/expired
            let nextBillingDate = new Date();
            if (company.current_period_end) {
                const currentPeriod = new Date(company.current_period_end)
                if (currentPeriod > nextBillingDate) {
                    // If it hasn't expired yet, add 30 days to the end of the current period
                    nextBillingDate = new Date(currentPeriod.getTime() + (30 * 24 * 60 * 60 * 1000));
                } else {
                    // If it expired, add 30 days from today
                    nextBillingDate.setDate(nextBillingDate.getDate() + 30);
                }
            } else {
                nextBillingDate.setDate(nextBillingDate.getDate() + 30);
            }

            // 3. Update Company Status and Billing Cycle
            const { error: updateError } = await supabase
                .from('companies')
                .update({
                    subscription_status: 'active',
                    subscription_plan: 'pro', // Assume pro after payment
                    current_period_end: nextBillingDate.toISOString(),
                })
                .eq('id', companyId)

            if (updateError) {
                console.error('Failed to update company:', updateError);
                throw new Error('Failed to update company status');
            }

            // 4. Upsert Charge record to mark it as Paid for History Log
            const { error: chargeError } = await supabase
                .from('company_charges')
                .upsert({
                    company_id: companyId,
                    provider: 'asaas',
                    amount: payment.value,
                    description: `Assinatura Lucro Certo - Pago #${payment.id}`,
                    external_reference: payment.id, // using payment.id as external ref for charge table uniqueness
                    payment_method: payment.billingType?.toLowerCase() || 'unknown',
                    status: 'paid',
                    gateway_id: payment.id,
                    paid_at: new Date().toISOString()
                }, { onConflict: 'external_reference' })

            if (chargeError) {
                console.error('Failed to update company_charges:', chargeError);
                // We don't fail the whole webhook just for the log
            }

            console.log(`[Asaas Webhook] Successfully processed activation for company ${company.trade_name}`);
        } else if (event === 'PAYMENT_OVERDUE') {
            // Optional: You could directly suspend them via Asaas event if needed
            // Currently our Cron handles this.
            console.log(`[Asaas Webhook] Ignored overdue event, cron handles it.`);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (err: any) {
        console.error('Webhook Error:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
