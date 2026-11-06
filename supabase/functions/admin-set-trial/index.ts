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
        const { company_id, days, custom_date, expire_now, status, plan } = body

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

        let targetDate: Date
        let targetStatus = status || 'active'
        let targetPlan = plan || 'trial'

        if (expire_now) {
            targetDate = new Date(Date.now() - 60 * 60 * 1000)
            targetStatus = 'unpaid'
        } else if (custom_date) {
            targetDate = new Date(custom_date)
            if (isNaN(targetDate.getTime())) {
                throw new Error('Data personalizada inválida')
            }
            if (targetDate < new Date()) {
                targetStatus = 'unpaid'
            }
        } else {
            const numDays = typeof days === 'number' && days > 0 ? days : 7
            targetDate = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000)
        }

        const updatePayload: any = {
            trial_ends_at: targetDate.toISOString(),
            subscription_status: targetStatus,
            subscription_plan: targetPlan
        }

        const { data: updated, error: updateError } = await supabaseAdmin
            .from('companies')
            .update(updatePayload)
            .eq('id', company_id)
            .select('id, trade_name, subscription_plan, subscription_status, trial_ends_at')
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
