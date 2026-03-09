import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        })
    }

    try {
        const { image_url, text_content, type } = await req.json()

        if (!image_url && !text_content) {
            return new Response(JSON.stringify({ error: "É necessário enviar imagem ou texto do documento." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        console.log(`Analisando Documento Financeiro com IA. Tipo: ${type || 'não informado'}`)

        const promptText = `
Aja como um contador especialista e assistente financeiro de altíssimo nível. 
Sua tarefa é ler os dados extraídos do documento anexado (que pode ser uma nota fiscal, guia DARF, boleto, cupom fiscal ou comprovante) e extrair ABSOLUTAMENTE TUDO para um lançamento no sistema de gestão.

IMPORTANTE:
1. Identifique o Valor Total exato, Data de Vencimento/Pagamento, e Nome do Emissor/Favorecido.
2. O campo "notes_suggestion" DEVE ser usado como um relatório detalhado! Nele, você deve colocar TUDO que houver de útil no documento (CNPJ do emissor, número de referência, período de apuração, número do documento, código da receita, observações originais, etc).
3. CRÍTICO PARA PAGAMENTOS: Se o documento for pagável (boleto com linha digitável, DARF com código de barras, QR Code traduzido para Pix Copia e Cola), você DEVE extrair e colocar o CÓDIGO DE BARRAS (linha digitável numérica) ou o CÓDIGO PIX de forma BEM DESTACADA no início do campo "notes_suggestion".

Modelos para o "notes_suggestion":
CÓDIGO PARA PAGAMENTO (Boleto/Pix): [inserir código aqui]
-----------------------------------------
DETALHES COMPLETOS DO DOCUMENTO:
- Emissor/Recebedor: [nome] (CNPJ: [cnpj])
- Número do Documento / Referência: [numero]
- Detalhes (Período, Código de Receita, etc): [dados]
- Tributos/Taxas Originais (Multas, Juros se aplicável): [valores]

Se não houver código de pagamento, pule a primeira linha e foque no detalhamento. Não invente dados que não estejam no documento.

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
4. Responda ESTRITAMENTE o JSON VÁLIDO sem marcadores Markdown extras, para não quebrar a decodificação.`

        if (!OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: "Configuração de IA ausente (OPENAI_API_KEY)" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        let messagesContent: any[] = [];

        if (text_content) {
            console.log("Processando conteúdo de texto (PDF)...");
            messagesContent = [
                { type: "text", text: promptText },
                { type: "text", text: `CONTEÚDO DO DOCUMENTO:\n${text_content.substring(0, 4000)}` }
            ];
        } else {
            console.log("Arquivo é uma imagem, usando Vision API...");
            messagesContent = [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: image_url } }
            ];
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

        const aiData = await aiResponse.json();
        const resultText = aiData.choices?.[0]?.message?.content || '{}';
        const result = JSON.parse(resultText);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })

    } catch (err: any) {
        console.error("Full error:", err, err.stack)
        return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })
    }
})
