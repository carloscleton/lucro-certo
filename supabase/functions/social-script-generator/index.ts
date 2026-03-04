import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

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

    // 1. Fetch profile
    const { data: profile } = await supabase
      .from('social_profiles')
      .select('*')
      .eq('company_id', company_id)
      .single()

    if (!profile) throw new Error("Perfil não encontrado.")

    // 2. Generate Content with Gemini 2.0 Flash (AI Studio)
    const { data: company } = await supabase.from('companies').select('trade_name').eq('id', company_id).single()
    const aiKey = Deno.env.get('GOOGLE_AI_STUDIO_KEY');

    const prompt = `Crie uma postagem de Instagram para a empresa: "${company?.trade_name}".
O nicho da empresa é: "${profile.niche}".
O tom de voz deve ser: "${profile.tone}".
O público-alvo é: "${profile.target_audience}".

Gere apenas o TEXTO FINAL (incluindo emojis) e pule duas linhas para colocar 5 hashtags estratégicas.
Se o modo vídeo estiver ativado, foque em um roteiro de locução impactante de 30-45 segundos.
Sem aspas e sem conversa filler, apenas o texto do post pronto. Não use títulos de seções.`;

    let script = '';

    if (aiKey) {
      console.log(`[Diagnostic] Usando Gemini 1.5 Flash via v1 Endpoint.`);
      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${aiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, topP: 0.95 }
        })
      });

      const aiData = await aiResponse.json();
      console.log(`[Diagnostic] Gemini Response Status: ${aiResponse.status}`);

      if (!aiResponse.ok) {
        console.error(`[Diagnostic] Erro Gemini:`, JSON.stringify(aiData));
        const errorDetail = aiData.error?.message || JSON.stringify(aiData);
        throw new Error(`Google AI Studio Error: ${errorDetail}`);
      }

      script = aiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Erro ao extrair texto da resposta do Gemini.';
      console.log(`[Diagnostic] Script gerado com sucesso.`);
    } else {
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
      script = aiData.choices?.[0]?.message?.content || 'Erro ao gerar script.';
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
