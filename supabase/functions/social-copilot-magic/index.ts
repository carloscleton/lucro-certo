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
    const { company_id, topic, image_custom_prompt, mode = 'full', media_type = 'feed', image_base64 } = await req.json()

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'Company ID is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // mode: 'full' (caption + image), 'caption' (only text), 'image' (only image), 'suggest_prompt' (only generates prompt text)
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

    if (mode === 'suggest_prompt') {
      let suggestMessages: any[];

      if (image_base64) {
        // Modo Vision: analisa o que está VISUALMENTE na imagem e propõe uma cena inspirada nela
        const visionPromptStr = `Você é um Diretor de Arte especialista em criação de prompts para geração de imagens com IA (DALL-E, Midjourney).

TAREFA: Analise a imagem fornecida com atenção e crie UM ÚNICO prompt em português (2-3 frases) para gerar uma NOVA imagem fotorealista para o Instagram, que seja visualmente inspirada e coerente com o tema, estética e setor que você VÊ na imagem.

INSTRUÇÕES CRÍTICAS:
- Sua base é O QUE VOCÊ VÊ na imagem: o setor/contexto (ex: médico, tecnologia, alimentação), as cores, o ambiente, o estilo.
- Crie uma NOVA cena fotográfica (não reproduza a imagem exatamente).
- Seja rico em detalhes visuais: iluminação específica (ex: luz suave de estúdio, golden hour, luz azulada de neon), ângulo da câmera, texturas e expressões.
- REGRA ABSOLUTA: JAMAIS inclua textos, palavras, letreiros, logos, números ou fontes na imagem sugerida. Apenas elementos visuais puros.
- Retorne APENAS o texto do prompt, sem introduções, sem explicações.`;

        suggestMessages = [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: image_base64 } },
              { type: 'text', text: visionPromptStr }
            ]
          }
        ];
      } else {
        // Modo criativo: sem imagem, gera baseado no nicho/tom
        const suggestPromptStr = `Você é um Diretor de Arte visionário trabalhando para a empresa "${tradeName}".
Nicho: "${niche}". Tom da marca: "${tone}". Público-alvo: "${audience}".

Crie UM ÚNICO prompt detalhado (em português, aprox. 2-3 frases) projetado para gerar uma fotografia hiper-realista para o Instagram.
SEJA SURPREENDENTE, DINÂMICO E EXTREMAMENTE CRIATIVO. Fuja de cenários engessados ou repetitivos.
Inove nas situações do dia a dia que conectem o público ao nicho. Especifique iluminação (ex: golden hour, luz de estúdio dramática, neon suave), ângulos cinematográficos, expressões faciais profundas e texturas do ambiente.

REGRAS OBRIGATÓRIAS:
1. Vá direto ao ponto. Comece a descrição imediatamente sem introduções como "A imagem mostra" ou "Uma foto de".
2. Foque estritamente no que é visual.
3. Regra absoluta de IA: NUNCA sugira colocar texto, palavras, letreiros, logos ou fontes dentro da imagem. Apenas a cena bruta visual realista.
4. Entregue apenas o texto do prompt e nada mais.`;
        suggestMessages = [{ role: 'user', content: suggestPromptStr }];
      }

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o', messages: suggestMessages, temperature: 1.1, max_tokens: 300 })
      });
      const data = await res.json();
      const generatedSuggestion = data.choices?.[0]?.message?.content || 'Cenário profissional moderno e realista...';
      return new Response(JSON.stringify({ success: true, prompt: generatedSuggestion }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (mode === 'suggest_blog_topic') {
      const blogPromptStr = `
Nicho da empresa: "${niche}". Público-alvo: "${audience}". Tom de voz: "${tone}".
Sugira UM ÚNICO tema criativo e específico (em português) para um artigo de blog SEO dessa empresa.
O tema deve ser curto (máximo 10 palavras), relevante para o público-alvo e otimizado para buscas do Google.
Seja extremamente criativo e varie os assuntos a cada chamada. Nunca repita temas genéricos.
Retorne APENAS o tema, sem aspas, sem explicações, sem numeração.
`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: blogPromptStr }], temperature: 1.2 })
      });
      const data = await res.json();
      const generatedTopic = data.choices?.[0]?.message?.content?.trim() || 'Dicas de gestão financeira para pequenas empresas';
      return new Response(JSON.stringify({ success: true, prompt: generatedTopic }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (mode === 'automation_template') {
      const t = topic || 'parabenizar o cliente';
      const automationPromptStr = `
Você é um consultor de marketing para a empresa "${tradeName}".
Nicho: "${niche}". Público: "${audience}". Tom de voz: "${tone}".

Crie um modelo de mensagem de WhatsApp curto, envolvente e profissional para a seguinte automação: "${t}".

REGRAS:
1. Comece com uma saudação calorosa.
2. Seja objetivo mas amigável.
3. Use variáveis no formato {name} para o nome do cliente.
4. Use emojis de forma moderada e profissional.
5. Termine com o nome da empresa: "${tradeName}".
6. NÃO use aspas no início ou fim.
7. O texto deve estar pronto para ser enviado via WhatsApp.

Retorne APENAS o texto da mensagem.
`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: automationPromptStr }], temperature: 0.7 })
      });
      const data = await res.json();
      const generatedTemplate = data.choices?.[0]?.message?.content?.trim() || 'Olá {name}, parabéns pelo seu dia!';
      return new Response(JSON.stringify({ success: true, template: generatedTemplate }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

REGRAS OBRIGATÓRIAS DE ENGAJAMENTO:
1. PRIMEIRA LINHA: Comece com um GANCHO MENTAL poderoso que prenda a atenção em 1 segundo (use curiosidade, surpresa ou dor do público).
2. CORPO: Texto envolvente com emojis estratégicos (não excessivos), máximo 5-8 linhas.
3. CTA (CHAMADA PARA AÇÃO): Termine o texto com uma PERGUNTA que convide o leitor a comentar. Ex: "Comenta aqui 💬 se você também já passou por isso!" ou "Salva esse post e marca um amigo que precisa ver! 🔖"
4. HASHTAGS: Pule duas linhas e adicione entre 8 e 12 hashtags estratégicas. Misture hashtags populares do nicho (alto volume) com hashtags de cauda longa (menor concorrência). Todas em português e sem espaços internos.
5. NUNCA coloque aspas no começo ou fim. Retorne apenas o texto final pronto para copiar e colar.`;


      try {
        let aiMessages: any[] = [{ role: 'user', content: chatPrompt }];

        if (image_base64) {
          const userContext = topic ? `Foque neste assunto/tema que o usuário pediu a seguir: "${topic}"` : 'Você precisa basear a legenda estritamente na imagem anexada.';
          const chatPromptVision = `
Você é o criador de conteúdo estrela da empresa "${tradeName}".
O nicho da empresa é: "${niche}". Tom de voz: "${tone}". Público-alvo: "${audience}".

${userContext}

Eu estou anexando a foto real do post. OLHE A IMAGEM E GERE A LEGENDA.
REGRAS OBRIGATÓRIAS DE ENGAJAMENTO:
1. PRIMEIRA LINHA: Comece com um GANCHO MENTAL poderoso.
2. CORPO: Texto envolvente de 4-6 linhas baseando-se no que está de fato visível na imagem enviada.
3. CTA: Uma pergunta final para comentários.
4. HASHTAGS: Pule duas linhas e adicione 8 a 12 hashtags.
Retorne apenas o texto final.`;

          aiMessages = [
            {
              role: 'user',
              content: [
                { type: "text", text: chatPromptVision },
                { type: "image_url", image_url: { url: image_base64 } }
              ]
            }
          ];
        }

        const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: aiMessages,
            temperature: 0.7,
            max_tokens: 500
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
        const isStory = media_type === 'story';
        const imageSize = isStory ? '1024x1792' : '1024x1024';
        const formatHint = isStory ? 'Vertical portrait format 9:16, optimized for Instagram Stories.' : 'Square format 1:1.';

        const imagePrompt = `Professional high-resolution hyper-realistic photography of: ${promptBase}. 
Visual style: Raw photo, DSLR, 8k resolution, natural lighting, authentic environment. NO ROBOTS, NO ILLUSTRATIONS, NO GRAPHICS, NO VECTOR. 
CRITICAL RULE: ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO QUOTES, NO FONTS ALLOWED ANYWHERE IN THE IMAGE. 
The image must look like a real camera capture, completely textless. Clean and aesthetic for Instagram. Audience: ${audience}. ${formatHint}`;

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
            size: imageSize
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
