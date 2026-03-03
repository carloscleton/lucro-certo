import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_VERSION = 'v19.0'

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const { company_id } = await req.json()
        if (!company_id) throw new Error('company_id is required')

        // 1. Fetch Profile and Posts
        const { data: profile } = await supabase
            .from('social_profiles')
            .select('ig_account_id, fb_access_token')
            .eq('company_id', company_id)
            .single()

        if (!profile?.ig_account_id || !profile?.fb_access_token) {
            throw new Error('Perfil do Instagram não conectado.')
        }

        const { data: posts } = await supabase
            .from('social_posts')
            .select('id, content, status, likes_count, comments_count')
            .eq('company_id', company_id)
            .eq('status', 'posted')
            .limit(20)

        if (!posts || posts.length === 0) {
            return new Response(JSON.stringify({ message: 'Nenhuma postagem publicada para monitorar.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 2. Fetch Business Discovery or Media Insights from Meta
        // Note: For real-time metrics per post, we need to iterate or use business_discovery
        // For this prototype, we'll try to fetch basic media insights if we have the media ids (which we should store in social_posts)

        // TODO: Store media_id from Meta in social_posts when publishing. 
        // For now, let's just return success to prove the connection.

        return new Response(JSON.stringify({
            success: true,
            message: 'Métricas sincronizadas com sucesso (Simulado por enquanto).',
            summary: {
                total_reach: 1250,
                avg_engagement: '4.2%',
                top_post: posts[0]?.content?.substring(0, 20)
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
