import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import pdfParse from 'npm:pdf-parse@1.1.1'
import { Buffer } from "node:buffer"

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
        const { image_url, type } = await req.json()

        if (!image_url) {
            return new Response(JSON.stringify({ error: "image_url obrigatório." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        console.log(`Analisando Documento Financeiro com IA. Tipo: ${type || 'não informado'}`)

        const promptText = `
Aja como um contador especialista e assistente financeiro. 
Sua tarefa é ler os dados extraídos do documento anexado (que pode ser uma nota fiscal, boleto, cupom fiscal ou comprovante de pix) e extrair os dados estruturados para um lançamento no sistema de gestão.

IMPORTANTE: Se for um boleto ou nota, foque no Valor Total, Vencimento e Nome do Emissor.
Se for um Pix, foque no Valor, Data e Nome do Favorecido/Pagador.

Responda APENAS um JSON válido no seguinte formato:
{
  "description": "Uma descrição curta e clara",
  "amount": 123.45,
  "date": "YYYY-MM-DD",
  "category_suggestion": "nome da categoria",
  "contact_suggestion": "Nome da Empresa ou Pessoa",
  "notes_suggestion": "observações extras se houver"
}

Regras:
1. Data formatada ISO YYYY-MM-DD.
2. Amount formatado como número (float).
3. Se não encontrar uma informação, retorne null no campo.
4. Responda APENAS o JSON, sem textos extras.`

        if (!OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: "Configuração de IA ausente (OPENAI_API_KEY)" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        let messagesContent: any[] = [];

        // Check if it's a PDF
        if (image_url.toLowerCase().split('?')[0].endsWith('.pdf')) {
            console.log("Arquivo é um PDF, extraindo texto...");
            const pdfResponse = await fetch(image_url);
            const arrayBuffer = await pdfResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const pdfData = await pdfParse(buffer);
            const extractedText = pdfData.text;

            console.log("Texto extraído com sucesso!");

            messagesContent = [
                { type: "text", text: promptText },
                { type: "text", text: `CONTEÚDO DO DOCUMENTO PDF:\n${extractedText.substring(0, 4000)}` }
            ];
        } else {
            // It's an image
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
                max_tokens: 500
            })
        });

        const aiData = await aiResponse.json();
        const resultText = aiData.choices?.[0]?.message?.content || '{}';
        const result = JSON.parse(resultText);

        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })

    } catch (err: any) {
        console.error(err)
        return new Response(JSON.stringify({ error: String(err?.message) }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 })
    }
})
