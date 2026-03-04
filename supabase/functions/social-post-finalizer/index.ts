import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id, content } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 1. Perfil e Empresa
    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    if (!profile) throw new Error("Perfil não encontrado.")

    // 2. Criar o Post
    const { data: insertedPost, error: insertErr } = await supabase
      .from('social_posts')
      .insert({
        company_id: company_id,
        content: content,
        media_type: profile.video_enabled ? 'reels' : 'feed',
        status: 'pending'
      })
      .select().single()

    if (insertErr) throw insertErr

    // 3. Processar Mídia (Vídeo em Background, Imagem Síncrona)
    let finalImageUrl = null;

    if (profile.video_enabled) {
      console.log(`[Diagnostic] Disparando vídeo em background para o post ${insertedPost.id}`);
      // Chamada assíncrona para o gerador de vídeo
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-video-generator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ post_id: insertedPost.id, company_id: company_id })
      }).catch(e => console.error("Erro ao disparar gerador de vídeo:", e));
    } else {
      // Gerar Imagem com OpenAI
      try {
        const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: `Professional high-quality photography about ${profile.niche} for business social media. Realistic style. Target audience: ${profile.target_audience}.`,
            n: 1,
            size: '1024x1024'
          })
        });
        const imageData = await imageRes.json();
        if (imageData.data?.[0]?.url) {
          finalImageUrl = imageData.data[0].url;
          await supabase.from('social_posts').update({ image_url: finalImageUrl }).eq('id', insertedPost.id);
        } else {
          console.error("Erro OpenAI Image:", imageData);
        }
      } catch (e) {
        console.error("Exceção OpenAI Image:", e);
      }
    }

    // 4. Enviar WhatsApp (Payload Robusto)
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase
        .from('instances')
        .select('instance_name, evolution_instance_id')
        .eq('company_id', company_id)
        .eq('status', 'connected')
        .limit(1)

      if (instances && instances.length > 0) {
        const instance = instances[0]
        const targetNumber = profile.approval_whatsapp.replace(/\D/g, '')
        const messageText = `🎨 *STUDIO IA: NOVO POST!*\n\nSeu post foi criado e está aguardando aprovação:\n\n*Legenda:*\n${content}\n\n${profile.video_enabled ? "_O vídeo está sendo processado e aparecerá em instantes._" : ""}\n\nResponda *1* para aprovar!`

        await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
          body: JSON.stringify({
            number: targetNumber,
            options: { delay: 1200, presence: "composing" },
            text: messageText,
            textMessage: { text: messageText } // Força ambos os formatos para garantir compatibilidade
          })
        }).catch(e => console.error("Erro ao enviar WhatsApp:", e))
      }
    }

    return new Response(JSON.stringify({ success: true, post_id: insertedPost.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("Erro fatal no finalizer:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
