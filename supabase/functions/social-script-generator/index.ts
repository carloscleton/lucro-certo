import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: profile } = await supabase.from('social_profiles').select('*').eq('company_id', company_id).single()
    const { data: company } = await supabase.from('companies').select('trade_name').eq('id', company_id).single()

    if (!profile) throw new Error("Perfil da IA não encontrado.")

    const prompt = `Crie uma postagem de Instagram para a empresa: "${company?.trade_name || 'Nossa Empresa'}".
Nicho: "${profile.niche}". Tom: "${profile.tone}".

Gere apenas o TEXTO FINAL pronto para postar (incluindo emojis) e 5 hashtags ao final. Sem conversas.`

    const aiKey = Deno.env.get('GOOGLE_AI_STUDIO_KEY')?.trim()
    let script = ''
    let logs = ''

    // Tentar Google v1 (Estável)
    if (aiKey) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${aiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        })
        const data = await res.json()
        if (res.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          script = data.candidates[0].content.parts[0].text
        } else {
          logs += `[G-v1: ${data.error?.message || 'Erro'}] `
        }
      } catch (e: any) {
        logs += `[G-Internal: ${e.message}] `
      }
    }

    // Backup OpenAI 
    if (!script) {
      const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
      if (openaiKey) {
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] })
          })
          const data = await res.json()
          if (res.ok) script = data.choices?.[0]?.message?.content
          else logs += `[O-v1: ${data.error?.message || 'Erro'}] `
        } catch (e: any) {
          logs += `[O-Internal: ${e.message}] `
        }
      }
    }

    if (!script) script = `🚨 ERRO DE CONEXÃO 🚨\n\nMotivo: As IAs estão temporariamente indisponíveis.\nRelatório: ${logs}\n\nTente escrever o texto manualmente por enquanto.`

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
