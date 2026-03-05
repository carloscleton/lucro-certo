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
    const { company_id, topic } = await req.json()

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'Company ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // 1. Check Profile
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

    const userInstructions = topic ? `Foque neste assunto/tema que o usuário pediu a seguir: "${topic}"` : 'Crie uma postagem geral sobre as vantagens de nosso serviço/produto.';

    // 2. Generate Caption with GPT-4o-mini
    const chatPrompt = `
Você é o criador de conteúdo estrela da empresa "${tradeName}".
O nicho da empresa é: "${niche}".
O tom de voz deve ser: "${tone}".
O público-alvo é: "${audience}".

${userInstructions}

Gere APENAS A LEGENDA da postagem (incluindo emojis) e termine pulando duas linhas e adicionando 5 hashtags estratégicas.
Não coloque aspas no começo ou fim, nem conversa fiada. Retorne apenas o texto final para copiar e colar.`;

    let generatedCaption = 'Legenda inteligente gerada com sucesso pela IA.';
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

      if (!chatRes.ok) {
        console.error('ChatGPT API Response not ok:', chatRes.status);
      } else {
        const chatData = await chatRes.json()
        if (chatData.error) {
          console.error("ChatGPT Error payload:", chatData.error);
        } else {
          generatedCaption = chatData.choices?.[0]?.message?.content || generatedCaption;
        }
      }
    } catch (chatErr) {
      console.error('Falha ao gerar texto com ChatGPT:', chatErr);
    }

    // 3. Generate Image with DALL-E 3 (com texto chamativo)
    let publicUrl = null;
    try {
      const imagePrompt = `Crie uma arte profissional e estética para Instagram sobre: ${topic || ('Serviços de ' + niche)}. 
A imagem DEVE conter um pequeno texto ou título principal chamativo em português centralizado com tipografia moderna. 
Estilo visual: moderno, limpo e profissional. Público: ${audience}. 
Certifique-se de que o texto em português esteja escrito corretamente.`;

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
      if (imageData.error) {
        console.error('Dall-E API Error:', imageData.error);
        throw new Error(imageData.error.message || 'Erro na API da OpenAI');
      }

      if (imageData.data && imageData.data.length > 0) {
        const imageUrlOpenai = imageData.data[0].url;

        // 4. Download DALL-E image and save to Supabase bucket
        const imgFetchRes = await fetch(imageUrlOpenai);
        const imgBlob = await imgFetchRes.blob();

        const fileName = `${company_id}/magic-${crypto.randomUUID()}.png`;

        const { error: uploadError } = await supabase.storage
          .from('social_media_assets')
          .upload(fileName, imgBlob, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) {
          console.error('Storage Upload Error:', uploadError);
        } else {
          const { data: publicData } = supabase.storage
            .from('social_media_assets')
            .getPublicUrl(fileName);
          publicUrl = publicData.publicUrl;
        }
      }
    } catch (imageErr) {
      console.error('Falha nao-critica ao gerar imagem com a OpenAI:', imageErr);
      // Fica publicUrl como null, a UI ainda terá a caption gerada
    }

    return new Response(JSON.stringify({
      success: true,
      caption: generatedCaption,
      image_url: publicUrl // Pode ser null se a magica da foto falhar
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
