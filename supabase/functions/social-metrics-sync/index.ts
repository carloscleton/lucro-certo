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
            .select('id, media_id, content, likes_count, comments_count, reach_count, impressions_count, conversion_count, estimated_roi_value')
            .eq('company_id', company_id)
            .eq('status', 'posted')

        if (posts && posts.length > 0) {
            // 2. Extra Step: If some posts have no media_id, try to fetch the latest media from IG and match by content
            const missingMediaIds = posts.filter(p => !p.media_id)
            if (missingMediaIds.length > 0) {
                try {
                    const mediaListUrl = `https://graph.facebook.com/${API_VERSION}/${profile.ig_account_id}/media?fields=id,caption,timestamp&limit=10&access_token=${profile.fb_access_token}`
                    const mediaListRes = await fetch(mediaListUrl)
                    const mediaListData = await mediaListRes.json()

                    if (mediaListData.data) {
                        for (const igMedia of mediaListData.data) {
                            // Try to find a matching post in our DB by matching caption
                            const matchedPost = missingMediaIds.find(p =>
                                igMedia.caption && p.content &&
                                (igMedia.caption.slice(0, 50) === p.content.slice(0, 50))
                            )
                            if (matchedPost) {
                                matchedPost.media_id = igMedia.id
                                await supabase.from('social_posts').update({ media_id: igMedia.id }).eq('id', matchedPost.id)
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error matching missing media_ids:", e)
                }
            }

            // 3. Fetch latest data from Meta for each post that has a media_id
            for (const post of posts) {
                if (post.media_id) {
                    try {
                        const fbUrl = `https://graph.facebook.com/${API_VERSION}/${post.media_id}?fields=like_count,comments_count,insights.metric(reach,impressions)&access_token=${profile.fb_access_token}`
                        const metaRes = await fetch(fbUrl)
                        const metaData = await metaRes.json()

                        if (!metaData.error) {
                            const newLikes = metaData.like_count || 0
                            const newComments = metaData.comments_count || 0
                            let newReach = 0
                            let newImpressions = 0

                            if (metaData.insights?.data) {
                                metaData.insights.data.forEach((insight: any) => {
                                    if (insight.name === 'reach') newReach = insight.values[0].value
                                    if (insight.name === 'impressions') newImpressions = insight.values[0].value
                                })
                            }

                            // Update DB
                            await supabase.from('social_posts').update({
                                likes_count: newLikes,
                                comments_count: newComments,
                                reach_count: newReach,
                                impressions_count: newImpressions,
                                last_metrics_sync: new Date().toISOString()
                            }).eq('id', post.id)

                            // Apply to local post object for summing
                            post.likes_count = newLikes
                            post.comments_count = newComments
                            post.reach_count = newReach
                            post.impressions_count = newImpressions
                        }
                    } catch (e) {
                        console.error(`Error fetching metrics for media ${post.media_id}:`, e)
                    }
                } else if (post.likes_count === 0 && post.reach_count === 0) {
                    // Fallback para posts de "demo" se não houver mídia real cadastrada ainda
                    // Isso ajuda o usuário a ver algo se ele acabou de postar sem o meu fix de media_id
                    // (Opcional, mas melhora o "Wow" factor se ele acabou de testar)
                    // post.likes_count = 1; post.reach_count = 5; 
                }
            }
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
