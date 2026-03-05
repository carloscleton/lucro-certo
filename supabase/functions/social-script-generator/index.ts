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

    const aiKey = Deno.env.get('GOOGLE_AI_STUDIO_KEY')
    let script = ''
    let errorLog = ''

    // Tentar Gemini (AI Studio) - Prioritário
    try {
      if (!aiKey) throw new Error("Chave do Google AI Studio não configurada.")

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(`Google AI erro: ${data.error?.message || JSON.stringify(data)}`)

      script = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (e: any) {
      errorLog += `[Erro Gemini: ${e.message}]\n`
    }

    // Fallback OpenAI se Gemini falhar ou retornar vazio
    if (!script) {
      try {
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) throw new Error("Chave da OpenAI não configurada.")

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
        })

        const data = await res.json()
        if (!res.ok) throw new Error(`OpenAI erro: ${data.error?.message || JSON.stringify(data)}`)

        script = data.choices?.[0]?.message?.content || ''
      } catch (e: any) {
        errorLog += `[Erro OpenAI: ${e.message}]\n`
      }
    }

    if (!script) {
      script = `⚠️ Falha total na geração do roteiro.\n\nRelatório Técnico:\n${errorLog}\n\nPor favor, verifique se suas chaves de API estão ativas e com saldo.`
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
