import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch profile and company
    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    const { data: company } = await supabase.from('companies').select('trade_name').eq('id', company_id).single()

    if (!profile) throw new Error("Perfil da IA não encontrado. Salve o perfil primeiro.")

    const prompt = `Crie uma postagem de Instagram para a empresa: "${company?.trade_name || 'Nossa Empresa'}".
O nicho da empresa é: "${profile.niche}".
Tom de voz: "${profile.tone}".
Público-alvo: "${profile.target_audience}".

Gere apenas o TEXTO FINAL (incluindo emojis) e pule duas linhas para colocar 5 hashtags estratégicas.
Não use títulos como "Legenda" ou "Hashtags". Apenas o conteúdo pronto para postar.`

    const aiKey = Deno.env.get('GOOGLE_AI_STUDIO_KEY')?.trim()
    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    let script = ''
    let errorLog = ''

    // 2. TENTATIVA GOOGLE (Gemini) - Tenta múltiplos modelos se falhar
    if (aiKey) {
      const modelsToTry = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-pro"
      ];

      for (const model of modelsToTry) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });

          const data = await res.json();
          if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            script = data.candidates[0].content.parts[0].text;
            break; // Sucesso!
          } else {
            errorLog += `[Erro ${model}: ${data.error?.message || 'Sem resposta'}]\n`;
          }
        } catch (e: any) {
          errorLog += `[Falha interna ${model}: ${e.message}]\n`;
        }
      }
    } else {
      errorLog += `[Google: Chave não configurada]\n`;
    }

    // 3. TENTATIVA OPENAI (Backup de 2º nível)
    if (!script && openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const data = await res.json();
        if (res.ok && data.choices?.[0]?.message?.content) {
          script = data.choices[0].message.content;
        } else {
          errorLog += `[Erro OpenAI: ${data.error?.message || 'Servidor indisponível'}]\n`;
        }
      } catch (e: any) {
        errorLog += `[Falha interna OpenAI: ${e.message}]\n`;
      }
    } else if (!openaiKey && !script) {
      errorLog += `[OpenAI: Chave não configurada]\n`;
    }

    // 4. RESULTADO FINAL
    if (!script) {
      script = `⚠️ Falha crítica na geração.\n\nRelatório de Diagnóstico:\n${errorLog}\n\n🔍 Sugestão: Verifique se suas chaves no Supabase Dashboard estão corretas e com faturamento ativo.`;
    }

    return new Response(JSON.stringify({ script }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    })
  }
})
