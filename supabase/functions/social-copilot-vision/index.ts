import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

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
    const { company_id, image_url } = await req.json()

    if (!company_id || !image_url) {
      return new Response(JSON.stringify({ error: "company_id e image_url obrigatórios." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    console.log(`Processando Imagem com IA. Company: ${company_id}, Img: ${image_url}`)

    // 1. Obter Perfil
    const { data: profile } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('company_id', company_id)
      .single()

    if (!profile) {
      return new Response(JSON.stringify({ error: "Perfil da IA não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // 2. Chamar OpenAI com Visão para ler a foto real e criar Legenda
    let generatedContent = '';
    if (OPENAI_API_KEY) {
      const prompt = `
Aja como o social media da empresa "${profile.trade_name || 'nossa empresa'}".
O nicho é: "${profile.niche}". O tom de voz é: "${profile.tone}". O público-alvo: "${profile.target_audience}".

Eu acabei de lhe passar a foto real (uma nova imagem recém-produzida ou capturada) que vamos postar.
Sua tarefa é OLHAR O QUE ESTÁ NA FOTO, entender o contexto do produto/cenário e criar uma LEGENDA sensacional de 3 a 4 parágrafos curtos para Instagram que tenha perfeita harmonia com o que está visível na imagem.

Use emojis estratégicos. Pule duas linhas e adicione 5 hashtags.
Gere apenas o texto final da legenda, sem aspas, sem filler.`

      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: image_url } }
                ]
              }
            ],
            max_tokens: 500
          })
        });

        const aiData = await aiResponse.json();
        generatedContent = aiData.choices?.[0]?.message?.content || 'Conheça nossos produtos sensacionais!';
      } catch (e) {
        console.error('Error with OpenAI Vision:', e);
        generatedContent = `🌟 Nós amamos entregar sempre o melhor! Confira esse clique especial da nossa rotina.\n\n#${profile.niche.replace(/\s/g, '')} #novidade`;
      }
    } else {
      generatedContent = `✨ Um clique especial preparado pela nossa equipe!\nFaça-nos uma visita.\n\n#marketing #sucesso`;
    }

    // 3. Salvar - CRITICAL: Posts de FOTO REAL devem ser 'feed', não 'reels'
    const { data: insertedPost, error: insertErr } = await supabase
      .from('social_posts')
      .insert({
        company_id: company_id,
        content: generatedContent,
        image_url: image_url,
        media_type: 'feed', // Força feed para fotos reais
        status: 'pending'
      })
      .select()
      .single()

    if (insertErr) {
      console.error('Erro ao salvar post:', insertErr)
      throw insertErr
    }

    // NOTA: Ignoramos o gerador de vídeo aqui pois o usuário enviou uma foto REAL dele.

    // 4. Enviar mensagem via Zap!
    if (profile.approval_whatsapp && insertedPost) {
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

          const messageText = `📸 *IA LEU A SUA FOTO!*
O Marketing Artificial acabou de ler a foto que você enviou e montou esta legenda abaixo que combina com a sua imagem:

*Legenda Sugerida:*
${generatedContent}

Deseja Aprovar e Postar no Instagram? (Responda *1* para aprovar ou *NAO*)
_(Ref: Post ${insertedPost.id})_`;

          let endpoint = `${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}`;
          let payload: any = {
            number: targetNumber,
            options: { delay: 1000, presence: "composing" }
          };

          if (image_url) {
            endpoint = `${EVO_API_URL}/message/sendMedia/${encodeURIComponent(instance.instance_name)}`;
            const isVideo = image_url.toLowerCase().includes('.mp4') || image_url.toLowerCase().includes('.mov');
            payload.mediaMessage = {
              mediatype: isVideo ? "video" : "image",
              caption: messageText,
              media: image_url
            };
          } else {
            payload.text = messageText;
            payload.textMessage = { text: messageText };
          }

          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
            body: JSON.stringify(payload)
          });
        }
      } catch (evoErr) {
        console.error('Erro Evolution Vision:', evoErr);
      }
    }

    return new Response(JSON.stringify({ success: true, post: insertedPost }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })

  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err?.message) }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 })
  }
})
