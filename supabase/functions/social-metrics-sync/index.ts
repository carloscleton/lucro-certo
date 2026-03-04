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

        const summary = {
            total_likes: 0,
            total_comments: 0,
            total_reach: 0,
            total_impressions: 0,
            total_conversions: 0,
            total_roi: 0,
            avg_engagement: '0%'
        }

        // 2. Fetch Latest Media directly from Instagram Account (Real-time Audit)
        try {
            const igMediaUrl = `https://graph.facebook.com/${API_VERSION}/${profile.ig_account_id}/media?fields=id,caption,like_count,comments_count,timestamp&limit=10&access_token=${profile.fb_access_token}`
            const igRes = await fetch(igMediaUrl)
            const igData = await igRes.json()

            if (igData.data && igData.data.length > 0) {
                // Fetch insights for each of the latest 10 media to get reach/impressions
                for (const media of igData.data) {
                    summary.total_likes += media.like_count || 0
                    summary.total_comments += media.comments_count || 0

                    try {
                        const insightsUrl = `https://graph.facebook.com/${API_VERSION}/${media.id}/insights?metric=reach,impressions&access_token=${profile.fb_access_token}`
                        const insRes = await fetch(insightsUrl)
                        const insData = await insRes.json()

                        if (insData.data) {
                            insData.data.forEach((insight: any) => {
                                if (insight.name === 'reach') summary.total_reach += insight.values[0].value || 0
                                if (insight.name === 'impressions') summary.total_impressions += insight.values[0].value || 0
                            })
                        }
                    } catch (e) {
                        console.error(`Error fetching insights for media ${media.id}:`, e)
                    }

                    // Try to update our local DB if we find a match by caption
                    if (media.caption) {
                        const { data: matchedPosts } = await supabase
                            .from('social_posts')
                            .select('id, media_id')
                            .eq('company_id', company_id)
                            .ilike('content', `%${media.caption.slice(0, 30)}%`)
                            .limit(1)

                        if (matchedPosts && matchedPosts.length > 0) {
                            const post = matchedPosts[0]
                            await supabase.from('social_posts').update({
                                media_id: media.id,
                                status: 'posted',
                                likes_count: media.like_count || 0,
                                comments_count: media.comments_count || 0,
                                posted_at: media.timestamp
                            }).eq('id', post.id)
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching real-time IG media list:', err)
        }

        // 3. Fetch Conversions/ROI from our DB
        const { data: dbPosts } = await supabase
            .from('social_posts')
            .select('conversion_count, estimated_roi_value')
            .eq('company_id', company_id)
            .eq('status', 'posted')

        if (dbPosts) {
            dbPosts.forEach(post => {
                summary.total_conversions += post.conversion_count || 0
                summary.total_roi += Number(post.estimated_roi_value || 0)
            })
        }

        if (summary.total_reach > 0) {
            const engRate = ((summary.total_likes + summary.total_comments) / summary.total_reach) * 100
            summary.avg_engagement = engRate.toFixed(1) + '%'
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Métricas sincronizadas com sucesso total.',
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
