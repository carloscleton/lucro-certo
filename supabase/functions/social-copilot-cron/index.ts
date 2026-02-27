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

      // 5. Send Notification via Evolution API to the company's owner/WhatsApp
      try {
        // For this, we need the owner's phone number or the company's designated AI whatsapp instance...
        // Assuming we use a Central Bot or the client's own instance if connected
        // Example: We send a generic text to an endpoint we just print here,
        // In full production, you select the exact whatsapp number of the owner.

        console.log(`[Whatsapp Simulator] Para ${company.trade_name}:
🤖 Bom dia! O seu 'Lucro Certo Marketing' preparou o post de hoje.
Legenda:
${generatedContent}

O que deseja fazer?
1️⃣ - Postar Agora no Instagram
2️⃣ - Agendar para as 18h
3️⃣ - Descartar`);

      } catch (evoErr) {
        console.error("Evolution api fail", evoErr)
      }

      processed++
    }

    return new Response(JSON.stringify({ message: "Job completed", processed }), { headers: { "Content-Type": "application/json" }, status: 200 })
  } catch (err: any) {
    return new Response(String(err?.message), { status: 500 })
  }
})
