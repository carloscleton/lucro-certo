import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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
        const { input, mode } = await req.json()

        if (!input) {
            return new Response(JSON.stringify({ error: 'Input text is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        let prompt = "";
        if (mode === 'field_only') {
            prompt = `
        Você é um copywriter de elite especialista em IA. 
        O usuário quer gerar uma sugestão criativa ou um template para um campo específico.
        
        CONTEXTO/SOLICITAÇÃO: "${input}"

        REGRAS:
        1. Se o campo solicitado for "agent_name", sugira um nome curto e cativante para um robô assistente. No JSON use a chave "agent_name".
        2. Se for "business_niche", sugira um nicho de mercado profissional e focado. No JSON use a chave "business_niche".
        3. Se for "business_description", escreva um parágrafo envolvente sobre o que a empresa faz. No JSON use a chave "business_description".
        4. Para qualquer outra solicitação (como templates de WhatsApp ou E-mail), gere o conteúdo solicitado no tom adequado. No JSON use obrigatoriamente a chave "text".
        
        Retorne APENAS o JSON.
        Exemplo: { "text": "Conteúdo gerado..." }
      `;
        } else {
            prompt = `
      Você é um especialista em estruturação de empresas e IA.
      Com base na descrição ou URL fornecida a seguir, extraia as seguintes informações para configurar um Agente de Vendas:
      
      DESCRIÇÃO: "${input}"

      REGRAS:
      1. Extraia o nome da empresa.
      2. Defina um nome amigável para o robô (ex: Assistente [Nome da Empresa]).
      3. Identifique o nicho de atuação.
      4. Crie uma descrição detalhada de como o robô deve se comportar e o que ele deve saber sobre a empresa.
      5. Liste até 5 serviços ou produtos principais com preços estimados (se não houver na descrição, invente preços plausíveis de mercado) e observações úteis.

      Retorne APENAS um JSON no seguinte formato:
      {
        "agent_name": "...",
        "business_niche": "...",
        "business_description": "...",
        "services_catalog": [
          { "name": "...", "price": "R$ ...", "notes": "..." },
          ...
        ]
      }
    `;
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
        console.log(`[MAGIC] Resposta bruta da OpenAI: ${content.substring(0, 100)}...`);

        // Clean JSON response from potential Markdown blocks or extra text
        let result;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const cleanContent = jsonMatch ? jsonMatch[0] : content;
            result = JSON.parse(cleanContent.replace(/```json/g, '').replace(/```/g, ''));
            console.log(`[MAGIC] JSON parseado com sucesso.`);
        } catch (e) {
            console.error('[MAGIC] Failed to parse JSON content:', content);
            result = { text: content }; // Fallback to raw content if JSON fails
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error(`[MAGIC] Erro Fatal na Edge Function:`, error);
        return new Response(JSON.stringify({ 
            error: error.message, 
            stack: error.stack,
            details: "Erro interno na Edge Function lead-radar-magic"
        }), { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
