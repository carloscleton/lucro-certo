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

    // Auth client
    const authHeader = req.headers.get('Authorization')!
    const authSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    // Admin client to bypass RLS for updating post later if needed 
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await authSupabase.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const action = body.action || 'publish'

    if (action === 'create_manual_post') {
      const { company_id, content, image_url, media_type } = body
      if (!company_id) {
        return new Response(JSON.stringify({ error: 'company_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // 1. Verificar se o user autenticado (com authSupabase) é admin/member da company_id
      const { data: member, error: memberErr } = await authSupabase
        .from('company_members')
        .select('*')
        .eq('company_id', company_id)
        .eq('user_id', user.id)
        .single()

      if (memberErr || !member) {
        return new Response(JSON.stringify({ error: 'Unauthorized for this company' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // 2. Inserir post bypassando RLS (com db client admin)
      const { data: newPost, error: insertError } = await supabase.from('social_posts').insert({
        company_id,
        content: content || '',
        image_url,
        media_type: media_type || 'feed',
        status: 'pending'
      }).select().single()

      if (insertError) {
        throw new Error('Falha ao inserir post: ' + insertError.message)
      }

      return new Response(JSON.stringify({ success: true, post: newPost }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Ação padrão: PUBLISH POST
    const { post_id } = body
    if (!post_id) {
      return new Response(JSON.stringify({ error: 'Post ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Buscar o post
    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', post_id)
      .single()

    if (postErr || !post) {
      console.error("Erro ao buscar post:", postErr)
      return new Response(JSON.stringify({ error: 'Post not found', req_id: post_id }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Buscar o profile da company
    const { data: profile, error: profileErr } = await supabase
      .from('social_profiles')
      .select('ig_account_id, fb_access_token')
      .eq('company_id', post.company_id)
      .single()

    if (profileErr || !profile) {
      console.error("Erro ao buscar profile:", profileErr)
      return new Response(JSON.stringify({ error: 'Profile not found para publicar' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { ig_account_id, fb_access_token } = profile

    if (!ig_account_id || !fb_access_token) {
      return new Response(JSON.stringify({ error: 'Instagram não conectado neste perfil.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Agora enviar para a API do Grafo do Instagram

    if (!post.image_url) {
      return new Response(JSON.stringify({ error: 'O Instagram exige uma imagem ou vídeo para publicar. Esta postagem não possui mídia.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 1. Criar container de imagem
    let isVideo = post.image_url.toLowerCase().endsWith('.mp4') || post.image_url.toLowerCase().endsWith('.mov');
    let mediaUrlParams = new URLSearchParams({
      access_token: fb_access_token,
      caption: post.content
    })

    if (isVideo) {
      mediaUrlParams.append('media_type', 'REELS')
      mediaUrlParams.append('video_url', post.image_url)
    } else {
      mediaUrlParams.append('image_url', post.image_url)
      if (post.media_type === 'story') {
        mediaUrlParams.append('media_type', 'STORIES')
      }
    }

    const mediaUrl = `https://graph.facebook.com/${API_VERSION}/${ig_account_id}/media?${mediaUrlParams.toString()}`

    const mediaRes = await fetch(mediaUrl, { method: 'POST' })
    const mediaData = await mediaRes.json()

    if (mediaData.error) {
      console.error('Erro Meta (container):', mediaData.error)
      throw new Error('Falha ao gerar preview da foto no Meta: ' + mediaData.error.message)
    }

    const creationId = mediaData.id

    // 2. Publicar o post
    const publishUrl = `https://graph.facebook.com/${API_VERSION}/${ig_account_id}/media_publish?creation_id=${creationId}&access_token=${fb_access_token}`

    const publishRes = await fetch(publishUrl, { method: 'POST' })
    const publishData = await publishRes.json()

    if (publishData.error) {
      console.error('Erro Meta (publish):', publishData.error)
      throw new Error('Falha ao publicar a foto no Meta: ' + publishData.error.message)
    }

    // 3. Sucesso! Atualizar status do post e salvar o media_id
    await supabase.from('social_posts').update({
      status: 'posted',
      media_id: publishData.id,
      posted_at: new Date().toISOString()
    }).eq('id', post_id)

    return new Response(JSON.stringify({ success: true, meta_id: publishData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Error no social-post-publisher:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
