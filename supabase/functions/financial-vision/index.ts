import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { image_url, text_content, type } = body;

        if (!image_url && !text_content) {
            return new Response(JSON.stringify({ error: "É necessário enviar imagem ou texto do documento." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        console.log(`[FinancialVision] Analisando Documento. Tipo: ${type || 'não informado'}`)

        if (!OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: "Configuração de IA ausente (OPENAI_API_KEY)" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        const promptText = `
Aja como um contador especialista e assistente financeiro de altíssimo nível. 
Sua tarefa é ler os dados extraídos do documento anexado (que pode ser uma nota fiscal, guia DARF, boleto, cupom fiscal ou comprovante) e extrair ABSOLUTAMENTE TUDO para um lançamento no sistema de gestão.

IMPORTANTE:
1. Identifique o Valor Total exato, Data de Vencimento/Pagamento, e Nome do Emissor/Favorecido.
2. O campo "notes_suggestion" DEVE ser usado como um relatório detalhado! Nele, você deve colocar TUDO que houver de útil no documento (CNPJ do emissor, número de referência, período de apuração, número do documento, código da receita, observações originais, etc).
3. CRÍTICO PARA PAGAMENTOS: Se o documento for pagável (boleto com linha digitável, DARF com código de barras, código PIX), você DEVE extrair O CÓDIGO LITERALMENTE IDÊNTICO AO ARQUIVO original. Não abrevie.

Modelos para o "notes_suggestion" (Use este template exato se aplicável, substituindo [ ] por informações. Embeleze usando Markdown):
**CÓDIGO PARA PAGAMENTO**
[Inserir Código Pix ou Linha Digitável do Barcode de forma cristalina. Exatamente igual ao original]

**RESUMO DO DOCUMENTO**
🏢 **Emissor/Recebedor:** [Nome] (CNPJ: [CNPJ se houver])
📄 **Número / Referência:** [Número]
📆 **Período / Apuração:** [Dados]
📊 **Código da Receita / Classificação:** [Dados]
💰 **Valores Extras:** [Multas, Juros se aplicável]

Se não houver código de pagamento, omita o primeiro bloco e foque no detalhamento. Não invente dados que não estejam no documento.

Responda APENAS um JSON válido no seguinte formato:
{
  "description": "Uma descrição clara e intuitiva para o lançamento (ex: Guia DARF Janeiro/2026, Fatura da Luz, Compra no Mercado)",
  "amount": 123.45,
  "date": "YYYY-MM-DD",
  "category_suggestion": "nome da categoria sugerida",
  "contact_suggestion": "Nome claro da Empresa, Órgão (ex: Receita Federal) ou Pessoa",
  "notes_suggestion": "O relatório completo e estruturado do documento, com o código de barras no topo se existir"
}

Regras:
1. Data formatada ISO YYYY-MM-DD.
2. Amount formatado como número DECIMAL APENAS (float), EX: 377.83 (use ponto, não vírgula. Sem "R$").
3. Se faltar algum campo do JSON que não seja texto, responda null.
4. Responda ESTRITAMENTE o JSON VÁLIDO sem marcadores Markdown extras.
5. PRESERVE OS MARCADORES: Se você encontrar dados entre >>>> e <<<< no conteúdo, você DEVE mantê-los EXATAMENTE como estão dentro do campo "notes_suggestion".`

        let messagesContent: any[] = [{ type: "text", text: promptText }];

        if (text_content) {
            console.log("[FinancialVision] Processando conteúdo de texto extraído...");
            messagesContent.push({ type: "text", text: `CONTEÚDO DO DOCUMENTO (TEXTOS/BARRAS/PIX):\n${text_content.substring(0, 5000)}` });
        }

        // Apenas envie a URL da imagem para a IA se NÃO for um PDF (A IA Vision só aceita imagens)
        if (image_url && !image_url.toLowerCase().split('?')[0].endsWith('.pdf')) {
            console.log("[FinancialVision] Arquivo de imagem detectado, acionando Vision API...");
            messagesContent.push({ type: "image_url", image_url: { url: image_url } });
        }

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: 'user',
                        content: messagesContent
                    }
                ],
                max_tokens: 1500
            })
        });

        if (!aiResponse.ok) {
            const errorData = await aiResponse.json().catch(() => ({}));
            console.error("[FinancialVision] OpenAI Error:", errorData);
            return new Response(JSON.stringify({ error: "Erro na comunicação com a OpenAI", details: errorData }), {
                status: aiResponse.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const aiData = await aiResponse.json();
        const resultText = aiData.choices?.[0]?.message?.content || '{}';
        const result = JSON.parse(resultText);

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
        })

    } catch (err: any) {
        console.error("[FinancialVision] Full error:", err)
        return new Response(JSON.stringify({
            error: err?.message || String(err),
            details: "Erro interno na Edge Function"
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500
        })
    }
})
