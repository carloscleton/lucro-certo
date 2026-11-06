import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { company_id, days, custom_date, expire_now, status, plan, next_billing_value, plan_only } = body

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // Verify the user making the request
        const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey)
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(token)

        if (userError || !user) {
            throw new Error('Not logged in')
        }

        if (user.email?.toLowerCase() !== 'carloscleton.nat@gmail.com') {
            throw new Error('Not authorized')
        }

        if (!company_id) {
            throw new Error('Missing company_id')
        }

        // Use service role to bypass RLS
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

        const updatePayload: any = {}

        if (expire_now) {
            updatePayload.trial_ends_at = new Date(Date.now() - 60 * 60 * 1000).toISOString()
            updatePayload.subscription_status = 'unpaid'
        } else if (custom_date) {
            const targetDate = new Date(custom_date)
            if (isNaN(targetDate.getTime())) {
                throw new Error('Data personalizada inválida')
            }
            updatePayload.trial_ends_at = targetDate.toISOString()
            if (targetDate < new Date()) {
                updatePayload.subscription_status = 'unpaid'
            } else if (status) {
                updatePayload.subscription_status = status
            }
        } else if (typeof days === 'number') {
            const numDays = days > 0 ? days : 7
            updatePayload.trial_ends_at = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString()
            if (status) updatePayload.subscription_status = status
        } else if (!plan_only && (days !== undefined || (status !== undefined && !plan))) {
            const numDays = 7
            updatePayload.trial_ends_at = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString()
            if (status) updatePayload.subscription_status = status
        }

        if (status && !updatePayload.subscription_status) {
            updatePayload.subscription_status = status
        }

        if (plan) {
            updatePayload.subscription_plan = plan
        }

        if (typeof next_billing_value === 'number') {
            updatePayload.next_billing_value = next_billing_value
        }

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('companies')
            .update(updatePayload)
            .eq('id', company_id)
            .select('id, trade_name, subscription_plan, subscription_status, trial_ends_at, next_billing_value')
            .single()

        if (updateError) {
            throw updateError
        }

        return new Response(
            JSON.stringify({ success: true, company: updated }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
