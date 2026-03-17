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
        const { company_id } = await req.json()

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing Authorization header')
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // Verify the user making the request
        const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey)
        const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser(authHeader.replace('Bearer ', ''))
        
        if (userError || !user) {
            throw new Error('Not logged in')
        }

        if (user.email !== 'carloscleton.nat@gmail.com') {
             throw new Error('Not authorized')
        }

        if (!company_id) {
            throw new Error('Missing company_id')
        }

        // Use service role to bypass RLS
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

        const { data: charges, error: chargesError } = await supabaseAdmin
            .from('company_charges')
            .select('*')
            .eq('company_id', company_id)
            .order('created_at', { ascending: false })

        if (chargesError) {
             throw chargesError;
        }

        return new Response(
            JSON.stringify({ success: true, charges }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
