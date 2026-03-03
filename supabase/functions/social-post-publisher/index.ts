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

    const { post_id } = await req.json()
    if (!post_id) {
      return new Response(JSON.stringify({ error: 'Post ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Buscar o post
    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('*, social_profiles(ig_account_id, fb_access_token)')
      .eq('id', post_id)
      .single()

    if (postErr || !post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { ig_account_id, fb_access_token } = post.social_profiles || {}

    if (!ig_account_id || !fb_access_token) {
      return new Response(JSON.stringify({ error: 'Instagram não conectado neste perfil.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Agora enviar para a API do Grafo do Instagram

    // 1. Criar container de imagem
    const mediaUrl = `https://graph.facebook.com/${API_VERSION}/${ig_account_id}/media?image_url=${encodeURIComponent(post.image_url)}&caption=${encodeURIComponent(post.content)}&access_token=${fb_access_token}`

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

    // 3. Sucesso! Atualizar status do post.
    await supabase.from('social_posts').update({ status: 'posted' }).eq('id', post_id)

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
