import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

serve(async (req) => {
  try {
    // Authenticate the cron caller (optional but recommended)
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET') || 'my_super_secret_cron'}`) {
      // return new Response('Unauthorized', { status: 401 })
      // Bypassing for initial tests
    }

    console.log('Marketing Copilot: Starting daily run')

    // 1. Fetch companies that have Social Copilot enabled TRUE
    const { data: companies, error: cmpError } = await supabase
      .from('companies')
      .select('id, trade_name')
      .eq('has_social_copilot', true)

    if (cmpError) throw cmpError
    if (!companies || companies.length === 0) {
      return new Response('Nenhuma empresa ativa para copilot.', { status: 200 })
    }

    let processed = 0;
    const processedLogs: any[] = [];

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
      if (OPENAI_API_KEY) {
        const prompt = `
Crie uma postagem de Instagram para a empresa: "${company.trade_name}".
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
        } catch (e) {
          console.error('Error with OpenAI:', e);
          generatedContent = `🌟 Novidades em breve na ${company.trade_name}!\n\n#${profile.niche.replace(/\s/g, '')} #novidade`;
        }
      } else {
        // Mock text if no AI KEY yet
        generatedContent = `✨ Postagem Sugerida para ${company.trade_name}:\nO melhor do ${profile.niche} está aqui. Fique ligado para novidades exclusivas que preparamos!\n\n#marketing #sucesso #${company.trade_name.replace(/\s+/g, '')}`;
      }

      // 4. Save to Database as Pending
      const { data: insertedPost } = await supabase
        .from('social_posts')
        .insert({
          company_id: company.id,
          content: generatedContent,
          status: 'pending'
        })
        .select()
        .single()

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
Responda *SIM* para aprovar ou *NAO* para descartar.

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

    return new Response(JSON.stringify({ message: "Job completed", processed, logs: processedLogs }), { headers: { "Content-Type": "application/json" }, status: 200 })
  } catch (err: any) {
    return new Response(String(err?.message), { status: 500 })
  }
})
