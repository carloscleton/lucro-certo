import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

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
    const { company_id, theme, post_count } = await req.json()

    if (!company_id || !theme || !post_count) {
      return new Response(JSON.stringify({ error: 'Faltam parâmetros obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (post_count > 7 || post_count < 1) {
      return new Response(JSON.stringify({ error: 'O número de posts deve ser entre 1 e 7.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!OPENAI_API_KEY) {
      throw new Error('Chave OpenAI não configurada.')
    }

    // 1. Check Profile
    const { data: profile } = await supabase
      .from('social_profiles')
      .select('niche, tone, target_audience, approval_whatsapp')
      .eq('company_id', company_id)
      .single()

    const { data: company } = await supabase
      .from('companies')
      .select('trade_name')
      .eq('id', company_id)
      .single()

    const niche = profile?.niche || 'Geral'
    const tone = profile?.tone || 'Profissional'
    const audience = profile?.target_audience || 'Clientes'
    const tradeName = company?.trade_name || 'Nossa Empresa'

    const chatPrompt = `
Você é o social media manager da empresa "${tradeName}".
O nicho da empresa é: "${niche}".
O tom de voz deve ser: "${tone}".
O público-alvo é: "${audience}".

Crie uma CAMPANHA com ${post_count} postagens separadas focadas estritamente no seguinte TEMA MESTRE: "${theme}".

Retorne EXATAMENTE um objeto JSON que contenha uma propriedade chamada "posts", que deve ser um Array de Objetos. Cada objeto dentro de "posts" deve ter 2 propriedades:
1) "caption": A legenda da postagem (incluindo emojis e 5 hashtags no final, sem conversa fiada).
2) "image_prompt": Uma sugestão curta em inglês (aprox 15-30 palavras) para desenhar a imagem. Deve ser profissional, "without text", "without letters".

Exemplo do formato:
{
  "posts": [
    { "caption": "Texto do post 1... #tag1", "image_prompt": "A modern abstract composition..." },
    { "caption": "Texto do post 2... #tag2", "image_prompt": "A professional office environment..." }
  ]
}
`;

    const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: chatPrompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    })

    const chatData = await chatRes.json()
    if (chatData.error) throw new Error(chatData.error.message)

    console.log("GPT RAW RESP:", chatData.choices?.[0]?.message?.content);
    const responseContent = chatData.choices?.[0]?.message?.content || '{}'

    let postsList = []
    try {
      const parsedObj = JSON.parse(responseContent);
      if (parsedObj.posts && Array.isArray(parsedObj.posts)) {
        postsList = parsedObj.posts;
      } else {
        throw new Error("Could not find 'posts' array in JSON");
      }
    } catch (parseError) {
      console.error("GPT JSON falhou:", responseContent);
      throw new Error('A IA não retornou os textos no formato esperado. Tente novamente.');
    }

    if (!Array.isArray(postsList) || postsList.length === 0) {
      throw new Error('Lista de postagens vazia retornada pela IA.')
    }

    // Limit just in case
    postsList = postsList.slice(0, post_count);

    const generatedPosts = [];

    // Processar imagens em paralelo
    const imagePromises = postsList.map(async (postItem) => {
      let publicUrl = null;
      try {
        const dallePrompt = postItem.image_prompt ?
          `Create a high quality image for Instagram: ${postItem.image_prompt}. Rule: NO TEXT, NO LETTERS. Professional style.` :
          `Create an abstract high quality image about ${theme} for ${niche}. NO TEXT, NO LETTERS.`;

        const imageRes = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: dallePrompt,
            n: 1,
            size: '1024x1024'
          })
        })

        const imageData = await imageRes.json()
        if (imageData.data && imageData.data.length > 0) {
          const imageUrlOpenai = imageData.data[0].url;

          // Download DALL-E image and save to Supabase bucket
          const imgFetchRes = await fetch(imageUrlOpenai);
          const imgBlob = await imgFetchRes.blob();

          const fileName = `${company_id}/campaign-${crypto.randomUUID()}.png`;

          const { error: uploadError } = await supabase.storage
            .from('social_media_assets')
            .upload(fileName, imgBlob, {
              contentType: 'image/png',
              upsert: true
            });

          if (!uploadError) {
            const { data: publicData } = supabase.storage
              .from('social_media_assets')
              .getPublicUrl(fileName);
            publicUrl = publicData.publicUrl;
          }
        }
      } catch (imgErr) {
        console.error('Falha nao-critica ao gerar imagem de campanha:', imgErr);
      }

      return {
        company_id,
        content: postItem.caption || '...',
        image_url: publicUrl,
        media_type: 'feed',
        status: 'pending'
      };
    });

    // Aguardar terminar todas as geracoes de imagem
    const postsDataToInsert = await Promise.all(imagePromises);

    // Inserir no banco
    const { data: insertedPosts, error: dbError } = await supabase
      .from('social_posts')
      .insert(postsDataToInsert)
      .select()

    if (dbError) throw dbError;

    // Enviar notificacao via Evolution API
    if (profile?.approval_whatsapp) {
      try {
        const { data: instances } = await supabase
          .from('instances')
          .select('instance_name, evolution_instance_id')
          .eq('company_id', company_id)
          .eq('status', 'connected')
          .limit(1);

        if (instances && instances.length > 0) {
          const instance = instances[0];
          const targetNumber = profile.approval_whatsapp.replace(/\D/g, '');

          // We'll send one message confirming the campaign creation with instructions
          const messageText = `🚀 *Mágica Concluída!*
Sua nova campanha sobre o tema _"${theme}"_ acaba de ser gerada com *${insertedPosts.length} postagens* inéditas, incluindo legendas e imagens criadas pela IA.

As postagens já estão pendentes e salvas na sua plataforma Web. Para publicá-las ou agendá-las no Instagram, acesse o painel.`;

          await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVO_API_KEY
            },
            body: JSON.stringify({
              number: targetNumber,
              options: { delay: 1200, presence: "composing" },
              text: messageText,
              textMessage: { text: messageText }
            })
          });
        }
      } catch (evoErr) {
        console.error('Falha nao-critica ao enviar wpp da campanha', evoErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: insertedPosts.length,
      posts: insertedPosts
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Campaign Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
