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
      const { company_id, content, image_url, media_type, scheduled_for } = body
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
        status: 'pending',
        scheduled_for
      }).select().single()

      if (insertError) {
        throw new Error('Falha ao inserir post: ' + insertError.message)
      }

      // 3. Notificar WhatsApp (Evolution API)
      const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br';
      const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto';

      if (EVO_API_URL && EVO_API_KEY) {
        try {
          // Buscar profile para pegar o numero de whatsapp
          const { data: profile } = await supabase
            .from('social_profiles')
            .select('approval_whatsapp')
            .eq('company_id', company_id)
            .single();

          if (profile?.approval_whatsapp) {
            // Buscar instancia da empresa
            const { data: instances } = await supabase
              .from('instances')
              .select('instance_name, evolution_instance_id')
              .eq('company_id', company_id)
              .eq('status', 'connected')
              .limit(1);

            if (instances && instances.length > 0) {
              const instance = instances[0];
              const targetNumber = profile.approval_whatsapp.replace(/\D/g, '');

              const messageText = `📸 *Postagem Manual Criada!*
Uma postagem manual acabou de ser salva e aguarda sua aprovação.

*Legenda:*
${content || '(Sem legenda descrita)'}

Deseja Aprovar e Postar Agora no Instagram?
Responda *1* para aprovar, *NAO* para descartar ou *VER* para revisar.

_(Ref: Post ${newPost.id})_`;

              let apiPath = `/message/sendText/${encodeURIComponent(instance.instance_name)}`;
              let payload: any = {
                number: targetNumber,
                options: { delay: 1200, presence: "composing" },
              };

              if (image_url) {
                apiPath = `/message/sendMedia/${encodeURIComponent(instance.instance_name)}`;
                const isVideo = image_url.toLowerCase().includes('.mp4') || image_url.toLowerCase().includes('.mov');
                payload.mediatype = isVideo ? "video" : "image";
                payload.caption = messageText;
                payload.media = image_url;
              } else {
                payload.text = messageText;
                payload.textMessage = { text: messageText };
              }

              const evoRes = await fetch(`${EVO_API_URL}${apiPath}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': EVO_API_KEY
                },
                body: JSON.stringify(payload)
              });

              const evoText = await evoRes.text();
              console.log("Evo API Response:", evoRes.status, evoText);
            }
          }
        } catch (evoErr) {
          console.error("Erro ao notificar whatsapp sobre post manual:", evoErr);
        }
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
    const isVideo = post.image_url.toLowerCase().endsWith('.mp4') || post.image_url.toLowerCase().endsWith('.mov');
    const isStory = post.media_type === 'story';
    
    // Configurar parâmetros base
    const params: any = {
      access_token: fb_access_token
    };

    if (!isStory) {
      params.caption = post.content || '';
    }

    if (isVideo) {
      params.video_url = post.image_url;
      params.media_type = isStory ? 'STORIES' : 'REELS';
    } else {
      params.image_url = post.image_url;
      if (isStory) {
        params.media_type = 'STORIES';
      }
    }

    console.log(`Criando container de mídia (isVideo: ${isVideo}, isStory: ${isStory})...`)
    
    const mediaUrl = `https://graph.facebook.com/${API_VERSION}/${ig_account_id}/media`
    const mediaRes = await fetch(mediaUrl, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    })

    const mediaData = await mediaRes.json()

    if (mediaData.error) {
      console.error('Erro Meta (container):', mediaData.error)
      let customError = mediaData.error.message;

      if (mediaData.error.message.includes("aspect ratio")) {
        customError = "A proporção da imagem não é suportada pelo Instagram. \n\nPara o FEED, use imagens quadradas (1:1) ou verticais de até 4:5. \n\nPara REELS/STORY, use 9:16 vertical.";
      }

      throw new Error(`Erro ao preparar mídia no Instagram (${mediaData.error.code}): ${customError}`)
    }

    const creationId = mediaData.id

    // 2. Aguardar o processamento (IMPORTANTE para vídeos e stories)
    console.log(`Container criado (${creationId}). Aguardando processamento...`)
    let ready = false
    let attempts = 0
    const maxAttempts = 15 // ~30-40 segundos total
    
    while (!ready && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 3000)) // Espera 3 segundos entre checagens
      attempts++
      
      const statusUrl = `https://graph.facebook.com/${API_VERSION}/${creationId}?fields=status_code,status&access_token=${fb_access_token}`
      const statusRes = await fetch(statusUrl)
      const statusData = await statusRes.json()
      
      console.log(`Status attempt ${attempts}:`, statusData.status_code)
      
      if (statusData.status_code === 'FINISHED') {
        ready = true
      } else if (statusData.status_code === 'ERROR') {
        throw new Error('O Meta falhou ao processar sua mídia: ' + (statusData.error_message || 'Erro Interno no Instagram'))
      } else if (statusData.error) {
        // Se der erro de permissão ou algo assim, para logo
        throw new Error('Erro ao checar status no Meta: ' + statusData.error.message)
      }
    }

    if (!ready) {
      throw new Error(`A mídia (Post ${post_id}) está demorando muito para ser processada pelo Instagram. Por favor, tente publicar novamente em alguns instantes.`)
    }

    // 2.5 Extra Sleep - Meta bug mitigation (Media ID not available even after FINISHED)
    console.log("Mídia finalizada. Aguardando respiro final (5s) antes de publicar...")
    await new Promise(r => setTimeout(r, 5000))

    // 3. Publicar o post
    const publishUrl = `https://graph.facebook.com/${API_VERSION}/${ig_account_id}/media_publish`
    const publishRes = await fetch(publishUrl, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: fb_access_token
      }).toString()
    })

    const publishData = await publishRes.json()

    if (publishData.error) {
      console.error('Erro Meta (publish):', publishData.error)
      throw new Error(`Falha ao publicar no Instagram (@${ig_account_id}): ${publishData.error.message}`)
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
