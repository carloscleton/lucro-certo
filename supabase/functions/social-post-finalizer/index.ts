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

    // 1. Buscar Perfil e Empresa
    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    const { data: company } = await supabase.from('companies').select('trade_name').eq('id', company_id).single()
    if (!profile || !company) throw new Error("Perfil não encontrado.")

    // 2. Criar o Post no Banco primeiro (Garante que os dados fiquem salvos)
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

    // 3. Enviar WhatsApp de Aprovação IMEDIATAMENTE
    if (profile.approval_whatsapp) {
      const { data: instances } = await supabase.from('instances').select('instance_name, evolution_instance_id').eq('company_id', company_id).eq('status', 'connected').limit(1)
      if (instances?.length) {
        const instance = instances[0]
        const targetNumber = profile.approval_whatsapp.replace(/\D/g, '')
        const msg = `🎨 *STUDIO IA: NOVO POST!*\n\nO roteiro que você editou foi salvo e está aguardando aprovação:\n\n${content}\n\nResponda *1* para aprovar!`

        await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
          body: JSON.stringify({ number: targetNumber, text: msg })
        }).catch(e => console.error("Erro WhatsApp inicial:", e))
      }
    }

    // 4. Se vídeo estiver ativo, disparar o gerador (agora vamos AWAIT mas com limite)
    if (profile.video_enabled) {
      console.log(`[Diagnostic] Iniciando geração de vídeo para o post ${insertedPost.id}`);
      // Chamamos o gerador de vídeo. Se ele demorar/falhar, não vamos travar o retorno do sucesso para o usuário.
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-video-generator`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: insertedPost.id, company_id: company_id })
      }).catch(e => console.error("Erro background video:", e));
    } else {
      // Se for imagem, gerar agora (DALL-E é rápido, podemos esperar)
      const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt: `Photography about ${profile.niche} for business Instagram. High quality. Public: ${profile.target_audience}.`, n: 1, size: '1024x1024' })
      });
      const imageData = await imageRes.json();
      if (imageData.data?.[0]?.url) {
        const imgUrl = imageData.data[0].url;
        await supabase.from('social_posts').update({ image_url: imgUrl }).eq('id', insertedPost.id);
      }
    }

    return new Response(JSON.stringify({ success: true, post_id: insertedPost.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
