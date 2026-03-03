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
            .select('likes_count, comments_count, reach_count, impressions_count, conversion_count, estimated_roi_value')
            .eq('company_id', company_id)
            .eq('status', 'posted')

        const summary = {
            total_likes: 0,
            total_comments: 0,
            total_reach: 0,
            total_impressions: 0,
            total_conversions: 0,
            total_roi: 0,
            avg_engagement: '0%'
        }

        if (posts && posts.length > 0) {
            posts.forEach(post => {
                summary.total_likes += post.likes_count || 0
                summary.total_comments += post.comments_count || 0
                summary.total_reach += post.reach_count || 0
                summary.total_impressions += post.impressions_count || 0
                summary.total_conversions += post.conversion_count || 0
                summary.total_roi += Number(post.estimated_roi_value || 0)
            })

            if (summary.total_reach > 0) {
                const engRate = ((summary.total_likes + summary.total_comments) / summary.total_reach) * 100
                summary.avg_engagement = engRate.toFixed(1) + '%'
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Métricas sincronizadas com sucesso.',
            summary
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
