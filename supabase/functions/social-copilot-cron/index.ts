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

    // --- NOVA LÓGICA DE FILTRO POR AGENDAMENTO ---
    // Se não for um disparo manual (target_company_id), verificamos o piloto automático
    if (!target_company_id) {
      if (!profile.autopilot_enabled) {
        console.log(`Empresa ${company.trade_name} ignorada - Piloto Automático desligado.`);
        continue;
      }

      const today = new Date().getDay(); // 0 = Domingo, 1 = Segunda...
      const freq = profile.autopilot_frequency || 'weekly';

      let shouldRunToday = false;
      if (freq === 'daily') shouldRunToday = true;
      else if (freq === 'thrice_weekly') shouldRunToday = [1, 3, 5].includes(today); // Seg, Qua, Sex
      else if (freq === 'weekly') shouldRunToday = (today === 1); // Apenas Segunda

      if (!shouldRunToday) {
        console.log(`Empresa ${company.trade_name} ignorada - Fora da frequência (${freq}) no dia ${today}.`);
        continue;
      }
    }
    // ---------------------------------------------

    // 3. Optional: Call OpenAI to generate content
    let generatedContent = '';
    let publicUrl = null;

    if (OPENAI_API_KEY) {
      const prompt = `Crie uma postagem de Instagram para a empresa: "${company.trade_name}".
O nicho da empresa é: "${profile.niche}".
O tom de voz deve ser: "${profile.tone}".
O público-alvo é: "${profile.target_audience}".

REGRAS OBRIGATÓRIAS DE ENGAJAMENTO:
1. PRIMEIRA LINHA: Comece com um GANCHO MENTAL poderoso que prenda a atenção em 1 segundo (use curiosidade, surpresa ou dor do público).
2. CORPO: Texto envolvente com emojis estratégicos (não excessivos), máximo 5-8 linhas.
3. CTA (CHAMADA PARA AÇÃO): Termine o texto com uma PERGUNTA que convide o leitor a comentar. Ex: "Comenta aqui 💬 se você também já passou por isso!" ou "Salva esse post e marca um amigo que precisa ver! 🔖"
4. HASHTAGS: Pule duas linhas e adicione entre 8 e 12 hashtags estratégicas. Misture hashtags populares do nicho (alto volume) com hashtags de cauda longa (menor concorrência). Todas em português e sem espaços internos.
5. NUNCA coloque aspas no começo ou fim. Retorne apenas o texto final pronto para copiar e colar.`;

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
            temperature: 0.9
          })
        });
        const aiData = await aiResponse.json();
        generatedContent = aiData.choices?.[0]?.message?.content || 'Erro ao gerar legenda com API.';

        // Gerar Imagem com DALL-E 3 — fotografia hiper-realista, SEM texto
        const imagePrompt = `Professional high-resolution hyper-realistic photography related to ${profile.niche}. 
Visual style: Raw photo, DSLR, 8k resolution, natural lighting, authentic environment. NO ROBOTS, NO ILLUSTRATIONS, NO GRAPHICS, NO VECTOR. 
CRITICAL RULE: ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO QUOTES, NO FONTS ALLOWED ANYWHERE IN THE IMAGE. 
The image must look like a real camera capture, completely textless. Clean and aesthetic for Instagram. Audience: ${profile.target_audience}. Square format 1:1.`;

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
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/social-video-generator`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ post_id: insertedPost.id, company_id: company.id })
        });

        // O gerador de vídeo já envia o WhatsApp de aprovação.
        // Pulamos o restante deste loop para esta empresa.
        processedLogs.push({ company: company.trade_name, event: 'Delegated to Video Generator', post_id: insertedPost.id });
        processed++;
        continue;
      } catch (videoErr) {
        console.error('Erro ao chamar gerador de vídeo:', videoErr);
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

      const endpoint = `${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVO_API_KEY
        },
        body: JSON.stringify({
          number: targetNumber,
          text: messageText,
          textMessage: { text: messageText },
          options: { delay: 1200, presence: "composing" }
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
