import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id, topic, image_custom_prompt, mode = 'full' } = await req.json()

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'Company ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // mode: 'full' (caption + image), 'caption' (only text), 'image' (only image)
    const shouldGenCaption = mode === 'full' || mode === 'caption';
    const shouldGenImage = mode === 'full' || mode === 'image';

    // 1. Check Profile for context
    const { data: profile } = await supabase
      .from('social_profiles')
      .select('niche, tone, target_audience')
      .eq('company_id', company_id)
      .single()

    const { data: company } = await supabase
      .from('companies')
      .select('trade_name')
      .eq('id', company_id)
      .single()

    const niche = profile?.niche || 'Geral'
    const tone = profile?.tone || 'Profissional e Engajador'
    const audience = profile?.target_audience || 'Qualquer pessoa'
    const tradeName = company?.trade_name || 'Nossa Empresa'

    let generatedCaption = '';
    let publicUrl = null;

    // 2. Generate Caption with GPT-4o-mini
    if (shouldGenCaption) {
      const userInstructions = topic ? `Foque neste assunto/tema que o usuário pediu a seguir: "${topic}"` : 'Crie uma postagem geral sobre as vantagens de nosso serviço/produto.';
      const chatPrompt = `
Você é o criador de conteúdo estrela da empresa "${tradeName}".
O nicho da empresa é: "${niche}".
O tom de voz deve ser: "${tone}".
O público-alvo é: "${audience}".

${userInstructions}

Gere APENAS A LEGENDA da postagem (incluindo emojis) e termine pulando duas linhas e adicionando 5 hashtags estratégicas.
Não coloque aspas no começo ou fim, nem conversa fiada. Retorne apenas o texto final para copiar e colar.`;

      try {
        const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: chatPrompt }],
            temperature: 0.7
          })
        })

        if (chatRes.ok) {
          const chatData = await chatRes.json()
          generatedCaption = chatData.choices?.[0]?.message?.content || 'Legenda gerada.';
        }
      } catch (chatErr) {
        console.error('Falha ao gerar texto:', chatErr);
      }
    }

    // 3. Generate Image with DALL-E 3
    if (shouldGenImage) {
      try {
        // Se houver um prompt customizado de imagem, damos prioridade total a ele
        // Caso contrário, usamos o tópico ou nicho.
        let promptBase = image_custom_prompt || topic || ('Serviços de ' + niche);

        const imagePrompt = `Professional high-resolution realistic photography of: ${promptBase}. 
Visual style: Real photo, natural lighting, authentic environment. NO ROBOTS, NO ILLUSTRATIONS, NO 3D RENDER, NO CARTOON. 
The image should look like a real camera capture. Clean and aesthetic for Instagram. Audience: ${audience}. 
If there is text, it must be in Portuguese and correctly written. Square format 1:1.`;

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
        })

        const imageData = await imageRes.json()
        if (!imageData.error && imageData.data && imageData.data.length > 0) {
          const imageUrlOpenai = imageData.data[0].url;

          // 4. Download and Save to Supabase
          const imgFetchRes = await fetch(imageUrlOpenai);
          const imgBlob = await imgFetchRes.blob();
          const fileName = `${company_id}/magic-${Date.now()}-${crypto.randomUUID()}.png`;

          const { error: uploadError } = await supabase.storage
            .from('social_media_assets')
            .upload(fileName, imgBlob, { contentType: 'image/png', upsert: true });

          if (!uploadError) {
            const { data: publicData } = supabase.storage.from('social_media_assets').getPublicUrl(fileName);
            publicUrl = publicData.publicUrl;
          }
        }
      } catch (imageErr) {
        console.error('Falha ao gerar imagem:', imageErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      caption: generatedCaption,
      image_url: publicUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Magic Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
