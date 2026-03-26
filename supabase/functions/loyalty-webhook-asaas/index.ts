import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

        const body = await req.json()
        const event = body.event
        const payment = body.payment

        console.log(`[Loyalty Webhook] Event: ${event}, Ref: ${payment.externalReference}`)

        if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
            const subscriptionId = payment.externalReference || payment.subscription
            
            // 1. Find Subscription
            const { data: subscription, error: subError } = await supabaseAdmin
                .from('loyalty_subscriptions')
                .select('*, plan:loyalty_plans(*)')
                .eq('id', subscriptionId)
                .single()

            let currentSub = subscription
            if (!subscription) {
                const { data: subByGateway } = await supabaseAdmin
                    .from('loyalty_subscriptions')
                    .select('*, plan:loyalty_plans(*)')
                    .eq('gateway_subscription_id', payment.subscription)
                    .single()
                
                if (!subByGateway) throw new Error(`Subscription not found for ref ${subscriptionId}`)
                currentSub = subByGateway
            }

            // 2. Register Loyalty Charge
            const { data: charge, error: chargeError } = await supabaseAdmin
                .from('loyalty_charges')
                .insert([{
                    company_id: currentSub.company_id,
                    subscription_id: currentSub.id,
                    amount: payment.value,
                    status: 'paid',
                    gateway_id: payment.id,
                    payment_link: payment.invoiceUrl || payment.invoiceCustomizationUrl
                }])
                .select()
                .single()

            if (chargeError) throw chargeError

            // 3. Update Subscription Dates
            const nextDate = new Date()
            if (currentSub.plan.billing_cycle === 'yearly') {
                nextDate.setFullYear(nextDate.getFullYear() + 1)
            } else {
                nextDate.setMonth(nextDate.getMonth() + 1)
            }

            await supabaseAdmin
                .from('loyalty_subscriptions')
                .update({
                    status: 'active',
                    last_billing_date: new Date().toISOString(),
                    next_billing_date: nextDate.toISOString()
                })
                .eq('id', currentSub.id)

            // 4. Create Transaction in Receivables (Integration)
            // Search for the company's "Fidelidade" category or create it
            const { data: category } = await supabaseAdmin
                .from('transaction_categories')
                .select('id')
                .eq('company_id', currentSub.company_id)
                .eq('name', 'Clube de Fidelidade')
                .maybeSingle()
            
            let categoryId = category?.id
            if (!categoryId) {
                const { data: newCat } = await supabaseAdmin
                    .from('transaction_categories')
                    .insert([{ company_id: currentSub.company_id, name: 'Clube de Fidelidade', type: 'revenue', icon: 'Award', color: '#f59e0b' }])
                    .select()
                    .single()
                categoryId = newCat?.id
            }

            await supabaseAdmin
                .from('transactions')
                .insert([{
                    company_id: currentSub.company_id,
                    contact_id: currentSub.id, // Or lead id? better lead id
                    category_id: categoryId,
                    amount: payment.value,
                    type: 'revenue',
                    status: 'paid',
                    date: new Date().toISOString().split('T')[0],
                    description: `Fidelidade: ${currentSub.plan.name} - Assinante: ${payment.customer}`,
                    created_at: new Date().toISOString()
                }])

            console.log(`[Loyalty Webhook] Processed successfully for sub ${currentSub.id}`)
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Loyalty Webhook Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})
