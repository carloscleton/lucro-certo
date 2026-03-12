import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function fetchGoogleMapsLeads(query: string, location: string) {
    if (!SERPAPI_KEY) return []
    try {
        const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&hl=pt&gl=br&api_key=${SERPAPI_KEY}`
        const res = await fetch(url)
        const data = await res.json()
        if (data.local_results) {
            return data.local_results.map((item: any) => ({
                platform: 'google_maps',
                name: item.title,
                description: item.description || `Empresa avaliada com ${item.rating} estrelas em ${item.address}.`,
                external_url: item.website || item.link,
                location: item.address || location,
                contact_number: item.phone ? item.phone.replace(/\D/g, '') : null,
                metadata: { rating: item.rating, type: item.type }
            }))
        }
        return []
    } catch (err) {
        console.error('Erro Maps:', err)
        return []
    }
}

async function fetchInstagramLeads(query: string, location: string) {
    if (!SERPAPI_KEY) return []
    try {
        // Busca dork no Google para Instagram
        const q = `site:instagram.com "${query}" "${location}"`
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&hl=pt&gl=br&api_key=${SERPAPI_KEY}`
        const res = await fetch(url)
        const data = await res.json()
        if (data.organic_results) {
            return data.organic_results.map((item: any) => ({
                platform: 'instagram',
                name: item.title.split('•')[0].trim(),
                description: item.snippet,
                external_url: item.link,
                location: location,
                contact_number: null,
                metadata: { source: 'organic_search' }
            }))
        }
        return []
    } catch (err) {
        console.error('Erro Instagram:', err)
        return []
    }
}

async function qualifyLead(company: any, agent: any, lead: any) {
    if (!GEMINI_API_KEY) return { score: 70, is_qualified: true, ai_summary: 'IA offline. Qualificação básica realizada.' }

    const prompt = `
        Analise a compatibilidade deste LEAD para a empresa "${company.trade_name}".
        Nossa empresa atua no nicho: ${agent.business_niche}.
        Nossos serviços: ${JSON.stringify(agent.services_catalog)}.
        Localização alvo: ${agent.target_location}.

        DADOS DO LEAD ENCONTRADO:
        Plataforma: ${lead.platform}
        Nome: ${lead.name}
        Descrição Capturada: ${lead.description}
        Localização do Lead: ${lead.location}

        REGRAS:
        1. Se o lead for de um nicho totalmente diferente ou localização muito distante, diminua o score.
        2. Se o lead parece precisar de algo que oferecemos, aumente o score.
        3. O "score" deve ser de 0 a 100.
        4. "is_qualified" é true se score > 60.

        RESPONDA APENAS O JSON:
        {
          "score": number,
          "is_qualified": boolean,
          "ai_summary": "resumo curto e profissional do porquê",
          "approach_message": "mensagem direta de whatsapp sugerida"
        }
    `

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        })
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        return jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 75, is_qualified: true, ai_summary: 'Análise concluída.' }
    } catch (err) {
        return { score: 70, is_qualified: true, ai_summary: 'Erro na análise da IA.' }
    }
}

async function runRadarMining(target_company_id?: string) {
    let processedCount = 0
    const processedLogs: any[] = []

    let query = supabase.from('company_ai_settings').select('*, companies(trade_name, id, trade_name)').eq('is_active', true)
    if (target_company_id) query = query.eq('company_id', target_company_id)

    const { data: activeAgents, error: agentError } = await query
    if (agentError) throw agentError

    for (const agent of activeAgents) {
        const company = agent.companies
        const loc = agent.target_location || 'Brasil'
        const niche = agent.business_niche

        // Coleta de multiplas fontes
        const [mapsLeads, instaLeads] = await Promise.all([
            fetchGoogleMapsLeads(niche, loc),
            fetchInstagramLeads(niche, loc)
        ])

        const allLeads = [...mapsLeads, ...instaLeads]

        for (const rawLead of allLeads) {
            // Verifica duplicata ANTES da IA para economizar tokens
            const { data: existing } = await supabase.from('radar_leads').select('id').eq('company_id', company.id).eq('name', rawLead.name).limit(1).maybeSingle()
            if (existing) continue

            // Qualificação Inteligente
            const qualification = await qualifyLead(company, agent, rawLead)
            if (!qualification.is_qualified) continue

            // Salva na Base
            const { data: newLead } = await supabase.from('radar_leads').insert({
                company_id: company.id,
                platform: rawLead.platform,
                name: rawLead.name,
                description: rawLead.description,
                external_url: rawLead.external_url,
                location: rawLead.location,
                score: qualification.score,
                ai_summary: qualification.ai_summary,
                metadata: { ...rawLead.metadata, contact_number: rawLead.contact_number, approach_message: qualification.approach_message },
                status: 'pending'
            }).select().single()

            // Abordagem Automática (se configurado)
            if (agent.auto_approach && newLead && rawLead.contact_number) {
                // Lógica de envio (já implementada anteriormente)
                const { data: instances } = await supabase.from('instances').select('instance_name').eq('company_id', company.id).eq('status', 'connected').limit(1)
                if (instances && instances.length > 0) {
                    const instance = instances[0]
                    const targetNumber = rawLead.contact_number.startsWith('55') ? rawLead.contact_number : `55${rawLead.contact_number}`
                    try {
                        await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
                            body: JSON.stringify({ number: targetNumber, text: qualification.approach_message || 'Olá!' })
                        })
                        await supabase.from('radar_leads').update({ status: 'approached', last_approach_at: new Date().toISOString() }).eq('id', newLead.id)
                    } catch (e) { console.error('Abordagem falhou:', e) }
                }
            }
            processedLogs.push({ lead: rawLead.name, score: qualification.score })
        }
        processedCount++
    }

    return { status: 'success', processedCount, logs: processedLogs }
}

serve(async (req: any) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const { company_id } = await req.json().catch(() => ({}))
        const result = await runRadarMining(company_id)
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { headers: corsHeaders, status: 500 })
    }
})
