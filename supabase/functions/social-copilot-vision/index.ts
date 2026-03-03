import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

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
            model: 'gpt-4o-mini', // gpt-4o-mini tem visão embutida!
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
        console.log("OpenAI Vision Result:", JSON.stringify(aiData).slice(0, 300));
        generatedContent = aiData.choices?.[0]?.message?.content || 'Conheça nossos produtos sensacionais! (Erro IA)';
      } catch (e) {
        console.error('Error with OpenAI Vision:', e);
        generatedContent = `🌟 Nós amamos entregar sempre o melhor! Confira esse clique especial da nossa rotina.\n\n#${profile.niche.replace(/\s/g, '')} #novidade`;
      }
    } else {
      generatedContent = `✨ Um clique especial preparado pela nossa equipe!\nFaça-nos uma visita.\n\n#marketing #sucesso`;
    }

    // 3. Salvar
    const { data: insertedPost, error: insertErr } = await supabase
      .from('social_posts')
      .insert({
        company_id: company_id,
        content: generatedContent,
        image_url: image_url,
        media_type: profile.video_enabled ? 'reels' : 'feed',
        status: 'pending'
      })
      .select()
      .single()

    if (insertErr) {
      console.error('Erro ao salvar post:', insertErr)
    }

    // 3.1 Se o vídeo estiver habilitado, chama o gerador de vídeo
    if (profile.video_enabled && insertedPost) {
      console.log(`Chamando gerador de vídeo para a empresa ${company_id} via Vision...`);
      try {
        const videoRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-video-generator`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ post_id: insertedPost.id, company_id: company_id })
        });
        const videoData = await videoRes.json();
        if (videoData.videoUrl) {
          insertedPost.image_url = videoData.videoUrl;
          insertedPost.media_type = 'reels';
        }
      } catch (videoErr) {
        console.error('Erro ao gerar vídeo no Vision, mantendo imagem estática:', videoErr);
      }
    }

    // 4. Enviar mensagem via Zap!
    if (profile.approval_whatsapp) {
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

          // Mensagem
          const messageText = `📸 *IA LEU A SUA FOTO!*
O Marketing Artificial acabou de ler a foto que você enviou e montou esta legenda abaixo que combina com a sua imagem:

*Legenda Sugerida:*
${generatedContent}

Link da Imagem no Servidor: ${image_url}

Deseja Aprovar? (Responda *1* para aprovar ou *NAO*)
_(Ref: Post ${insertedPost?.id})_`;

          await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
            body: JSON.stringify({
              number: targetNumber,
              text: messageText,
              textMessage: { text: messageText }
            })
          });
        }
      } catch (evoErr) {
        console.error('Erro Evolution:', evoErr);
      }
    }

    return new Response(JSON.stringify({ success: true, post: insertedPost }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })

  } catch (err: any) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err?.message) }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 })
  }
})
