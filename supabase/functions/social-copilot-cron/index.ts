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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function runCopilotJobs(target_company_id?: string) {
  console.log('Marketing Copilot: Starting run', target_company_id ? `for company ${target_company_id}` : 'for all companies')
  let processed = 0;
  const processedLogs: any[] = [];

  // 1. Fetch companies
  let query = supabase
    .from('companies')
    .select('id, trade_name')
    .eq('has_social_copilot', true);

  if (target_company_id) {
    query = query.eq('id', target_company_id);
  }

  const { data: companies, error: cmpError } = await query;

  if (cmpError) throw cmpError
  if (!companies || companies.length === 0) {
    return { message: 'Nenhuma empresa ativa para copilot.', processed, logs: processedLogs }
  }

  for (const company of companies) {
    // 2. See if they have a configured Profile
    const { data: profile } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('company_id', company.id)
      .single()

    if (!profile) {
      console.log(`Empresa ${company.trade_name} ignorada - sem perfil IA salvo.`)
      continue
    }

    // 3. Optional: Call OpenAI to generate content
    let generatedContent = '';
    let publicUrl = null;

    if (OPENAI_API_KEY) {
      const prompt = `Crie uma postagem de Instagram para a empresa: "${company.trade_name}".
O nicho da empresa é: "${profile.niche}".
O tom de voz deve ser: "${profile.tone}".
O público-alvo é: "${profile.target_audience}".

Gere apenas a LEGENDA (incluindo emojis) e pule duas linhas para colocar 5 hashtags estratégicas.
Sem aspas e sem conversa filler, apenas o texto do post pronto.`;

      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7
          })
        });
        const aiData = await aiResponse.json();
        generatedContent = aiData.choices?.[0]?.message?.content || 'Erro ao gerar legenda com API.';

        // Gerar Imagem com DALL-E 3
        const imagePrompt = `Crie uma fotografia profissional, ultra-realista e de alta qualidade (estilo raw photo), formato quadrado, sem letras e sem textos visíveis. A imagem deve ser natural e humanizada, retratando pessoas reais ou ambientes de trabalho autênticos sobre o nicho: ${profile.niche}. Evite terminantemente ilustrações, 3D render, desenhos ou qualquer estilo futurista robótico. Público: ${profile.target_audience}.`;

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
        if (!imageData.error && imageData.data && imageData.data.length > 0) {
          const imageUrlOpenai = imageData.data[0].url;

          // Baixar imagem do DALL-E e salvar no Supabase Storage
          const imgFetchRes = await fetch(imageUrlOpenai);
          const imgBlob = await imgFetchRes.blob();

          const fileName = `${company.id}/cron-${crypto.randomUUID()}.png`;
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
      } catch (e) {
        console.error('Error with OpenAI generation in CRON:', e);
        if (!generatedContent) generatedContent = `🌟 Novidades em breve na ${company.trade_name}!\n\n#${profile.niche.replace(/\s/g, '')} #novidade`;
      }
    } else {
      generatedContent = `✨ Postagem Sugerida para ${company.trade_name}:\nO melhor do ${profile.niche} está aqui. Fique ligado para novidades exclusivas que preparamos!\n\n#marketing #sucesso #${company.trade_name.replace(/\s+/g, '')}`;
    }

    // 4. Save to Database as Pending
    const { data: insertedPost } = await supabase
      .from('social_posts')
      .insert({
        company_id: company.id,
        content: generatedContent,
        image_url: publicUrl,
        media_type: profile.video_enabled ? 'reels' : 'feed',
        status: 'pending'
      })
      .select()
      .single()

    // 4.1 Se o vídeo estiver habilitado, chama o gerador de vídeo
    if (profile.video_enabled && insertedPost) {
      console.log(`Chamando gerador de vídeo para a empresa ${company.trade_name}...`);
      try {
        const videoRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-video-generator`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ post_id: insertedPost.id, company_id: company.id })
        });
        const videoData = await videoRes.json();
        if (videoData.videoUrl) {
          insertedPost.image_url = videoData.videoUrl;
          insertedPost.media_type = 'reels';
        }
      } catch (videoErr) {
        console.error('Erro ao gerar vídeo, mantendo imagem estática:', videoErr);
      }
    }

    let dispatchLog = 'No action';
    // 5. Send Notification via Evolution API to the company's owner/WhatsApp
    try {
      if (!profile.approval_whatsapp) {
        dispatchLog = `Skipped: no approval_whatsapp config`;
        console.log(`Empresa ${company.trade_name} ignorada para WhatsApp - sem numero de approvação configurado.`);
        processedLogs.push({ company: company.trade_name, event: dispatchLog });
        processed++
        continue;
      }

      // Fetch an active instance for this company
      const { data: instances } = await supabase
        .from('instances')
        .select('instance_name, evolution_instance_id')
        .eq('company_id', company.id)
        .eq('status', 'connected')
        .limit(1);

      if (!instances || instances.length === 0) {
        dispatchLog = `Skipped: no instance found or not 'connected'`;
        console.log(`Empresa ${company.trade_name} ignorada para WhatsApp - sem instância conectada.`);
        processedLogs.push({ company: company.trade_name, event: dispatchLog });
        processed++
        continue;
      }

      const instance = instances[0];
      const targetNumber = profile.approval_whatsapp.replace(/\D/g, '');

      const messageText = `🤖 Olá! O seu *Marketing IA* preparou o post de hoje.

*Legenda:*
${generatedContent}

Deseja Aprovar e Postar Agora no Instagram?
Responda *1* para aprovar ou *NAO* para descartar.

_(Ref: Post ${insertedPost.id})_`;

      dispatchLog = `Attempting send to ${targetNumber} via instance ${instance.instance_name}`;

      const response = await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}?token=${instance.evolution_instance_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVO_API_KEY
        },
        body: JSON.stringify({
          number: targetNumber,
          options: { delay: 1200, presence: "composing" },
          text: messageText,
          textMessage: { text: messageText } // Manter os dois para compatibilidade de versao evo
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        dispatchLog += ` | ERROR: ${errText}`;
      } else {
        dispatchLog += ` | SUCCESS!`;
      }
    } catch (evoErr: any) {
      dispatchLog += ` | FATAL_ERROR: ${evoErr?.message}`;
    }

    processedLogs.push({ company: company.trade_name, event: dispatchLog, post_id: insertedPost?.id, content: generatedContent });
    processed++
  }

  return { message: "Job completed", processed, logs: processedLogs };
}

// -------------------------------------------------------------
// 1. Cron Trigger: Runs automatically everyday at 09:00 AM UTC (06:00 BRT)
// -------------------------------------------------------------
if (typeof (Deno as any).cron === 'function') {
  (Deno as any).cron('Social Copilot Daily Generation', '0 9 * * *', async () => {
    try {
      console.log("Triggered by Deno Cron Engine");
      await runCopilotJobs();
    } catch (err) {
      console.error("Cron Engine Error:", err);
    }
  })
} else {
  console.warn("Deno.cron is not available in this environment.");
}

// -------------------------------------------------------------
// 2. HTTP Trigger: For the manual "Gerar Agora" button in the App
// -------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id } = await req.json().catch(() => ({}));
    const result = await runCopilotJobs(company_id);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })
  } catch (err: any) {
    return new Response(String(err?.message), { headers: corsHeaders, status: 500 })
  }
})
