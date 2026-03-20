import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
        if (!OPENAI_API_KEY) {
            throw new Error("Missing OPENAI_API_KEY in project secrets.");
        }

        const body = await req.json().catch(() => ({}));
        const { input, mode } = body;

        if (!input) {
            return new Response(JSON.stringify({ error: 'Input text is required' }), { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            })
        }

        let prompt = "";
        if (mode === 'field_only') {
            prompt = `Você é um copywriter de elite especialista em IA. 
O usuário quer gerar uma sugestão criativa ou um template para um campo específico.
            
CONTEXTO/SOLICITAÇÃO: "${input}"

REGRAS:
1. Se o campo solicitado for "agent_name", sugira um nome curto e cativante para um robô assistente. No JSON use a chave "agent_name".
2. Se for "business_niche", sugira um nicho de mercado profissional e focado. No JSON use a chave "business_niche".
3. Se for "business_description", escreva um parágrafo envolvente sobre o que a empresa faz. No JSON use a chave "business_description".
4. Para qualquer outra solicitação (como templates de WhatsApp ou E-mail), gere o conteúdo solicitado no tom adequado. No JSON use obrigatoriamente a chave "text".

Retorne APENAS o JSON.
Exemplo: { "text": "Conteúdo gerado..." }`;
        } else {
            prompt = `Você é um especialista em estruturação de empresas e IA.
Com base na descrição ou URL fornecida a seguir, extraia as seguintes informações para configurar um Agente de Vendas:

DESCRIÇÃO: "${input}"

REGRAS:
1. Extraia o nome da empresa.
2. Defina um nome amigável para o robô.
3. Identifique o nicho de atuação.
4. Crie uma descrição detalhada de como o robô deve se comportar.
5. Liste até 5 serviços ou produtos principais com preços estimados.

Retorne APENAS um JSON:
{
    "agent_name": "...",
    "business_niche": "...",
    "business_description": "...",
    "services_catalog": [
        { "name": "...", "price": "R$ ...", "notes": "..." }
    ]
}`;
        }

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
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

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";

        let result;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const cleanContent = jsonMatch ? jsonMatch[0] : content;
            result = JSON.parse(cleanContent.replace(/```json/g, '').replace(/```/g, ''));
        } catch (e) {
            result = { text: content };
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ 
            error: error.message, 
            details: "Erro interno na Edge Function lead-radar-magic"
        }), { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
