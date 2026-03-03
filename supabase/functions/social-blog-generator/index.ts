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
        const { company_id, topic } = await req.json()

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

        // 2. Generate Blog Post with GPT
        const { data: company } = await supabase.from('companies').select('trade_name').eq('id', company_id).single()

        const prompt = `Você é um redator especialista em SEO. Escreva um ARTIGO DE BLOG completo e profissional para a empresa: "${company?.trade_name}".
O tópico do artigo é: "${topic}".
O nicho da empresa é: "${profile.niche}".
O tom de voz deve ser: "${profile.tone}".
O público-alvo é: "${profile.target_audience}".

Estruture o artigo com:
1. Título Impactante (H1)
2. Introdução Cativante
3. Subtítulos (H2 e H3) explorando o tema
4. Conclusão com CTA (Chamada para Ação)
5. Lista de palavras-chave sugeridas no final.

O artigo deve ter pelo menos 600 palavras e ser rico em informações úteis.
Use formatação Markdown para os títulos e listas.
Sem conversa filler, apenas o conteúdo do artigo pronto para ser publicado.`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.8
            })
        });

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content || 'Erro ao gerar conteúdo.';

        return new Response(JSON.stringify({ content }), {
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
