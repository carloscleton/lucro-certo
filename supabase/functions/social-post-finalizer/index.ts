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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id, content } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch Profile and Company
    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    const { data: company } = await supabase.from('companies').select('trade_name').eq('id', company_id).single()

    if (!profile || !company) throw new Error("Perfil ou empresa não encontrados.")

    let publicUrl = null;

    // 2. Decide if Video or Image
    if (!profile.video_enabled) {
      // Generate Image with DALL-E 3
      const brandInfo = profile.brand_logo_url ? `Please ensure the overall aesthetic feels ready for a brand watermark.` : '';
      const colorInfo = profile.brand_primary_color ? `The image should emphasize or subtly feature the brand color ${profile.brand_primary_color}.` : '';

      const imagePrompt = `Crie uma fotografia profissional, ultra-realista e de alta qualidade (estilo raw photo), formato quadrado, sem letras e sem textos visíveis. 
      A imagem deve ser natural e humanizada, retratando pessoas reais ou ambientes de trabalho autênticos sobre o nicho: ${profile.niche}. 
      ${colorInfo} ${brandInfo}
      Evite terminantemente ilustrações, 3D render, desenhos ou qualquer estilo futurista robótico. Público: ${profile.target_audience}.`;

      const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1024'
        })
      });

      const imageData = await imageRes.json();
      if (imageData.data && imageData.data.length > 0) {
        const imageUrlOpenai = imageData.data[0].url;
        const imgFetchRes = await fetch(imageUrlOpenai);
        const imgBlob = await imgFetchRes.blob();

        const fileName = `${company_id}/studio-${crypto.randomUUID()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('social_media_assets')
          .upload(fileName, imgBlob, { contentType: 'image/png' });

        if (!uploadError) {
          const { data: publicData } = supabase.storage
            .from('social_media_assets')
            .getPublicUrl(fileName);
          publicUrl = publicData.publicUrl;
        }
      }
    }

    // 3. Save Post
    const { data: insertedPost, error: insertErr } = await supabase
      .from('social_posts')
      .insert({
        company_id: company_id,
        content: content,
        image_url: publicUrl,
        media_type: profile.video_enabled ? 'reels' : 'feed',
        status: 'pending'
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    // 4. If Video Enabled, Trigger Video Generator in BACKGROUND
    if (profile.video_enabled && insertedPost) {
      console.log(`[Diagnostic] Disparando geração de vídeo em background para o post ${insertedPost.id}`);
      // NÃO usamos await aqui. Isso libera o frontend na hora!
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-video-generator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ post_id: insertedPost.id, company_id: company_id })
      }).catch(e => console.error("Erro no disparo background:", e));
    } else if (profile.approval_whatsapp) {
      // 5. Se for IMAGEM (não vídeo), enviamos o WhatsApp daqui mesmo, pois a imagem é rápida
      const { data: instances } = await supabase
        .from('instances')
        .select('instance_name, evolution_instance_id')
        .eq('company_id', company_id)
        .eq('status', 'connected')
        .limit(1);

      if (instances && instances.length > 0) {
        const instance = instances[0];
        const targetNumber = profile.approval_whatsapp.replace(/\D/g, '');
        const messageText = `🎨 *STUDIO IA REALIZADO!*
O Marketing Artificial acabou de finalizar a imagem para o seu post:

*Legenda Finalizada:*
${content}

Deseja Aprovar? (Responda *1* para aprovar ou *NAO*)
_(Ref: Post ${insertedPost.id})_`;

        await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVO_API_KEY
          },
          body: JSON.stringify({
            number: targetNumber,
            text: messageText,
            textMessage: { text: messageText }
          })
        }).catch(e => console.error("Erro WhatsApp Imagem:", e));
      }
    }

    return new Response(JSON.stringify({ success: true, post_id: insertedPost.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
