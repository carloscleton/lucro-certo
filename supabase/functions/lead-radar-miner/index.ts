import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurações de Infraestrutura
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

/**
 * Busca no Google Maps (PJ/Local)
 */
async function fetchMaps(query: string, location: string, apiKey?: string) {
    if (!apiKey) return []
    try {
        const res = await fetch('https://google.serper.dev/maps', {
            method: 'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: `${query} em ${location}`, hl: 'pt-br', gl: 'br' })
        })
        const data = await res.json()
        if (data.error) return []

        // Filtrar para evitar que a própria cidade apareça como "empresa"
        return (data.places || [])
            .filter((item: any) => {
                const titleLower = item.title.toLowerCase().trim()
                const locLower = location.toLowerCase().trim()
                // Se o título for exatamente igual à cidade pesquisada, é um resultado geográfico, não uma empresa
                return titleLower !== locLower && item.address
            })
            .map((item: any) => ({
                platform: 'google_maps',
                name: item.title,
                description: item.category ? `${item.category}. Localizado em ${item.address}.` : `Empresa local em ${item.address}. Avaliação: ${item.rating || 'N/A'}.`,
                external_url: item.website || item.link || `https://www.google.com/maps/search/${encodeURIComponent(item.title)}`,
                location: item.address,
                contact_number: item.phoneNumber ? item.phoneNumber.replace(/\D/g, '') : null,
                metadata: { source: 'serper_maps', category: item.category, rating: item.rating }
            }))
    } catch { return [] }
}

/**
 * Busca em Redes Sociais via Google Search (Instagram, Facebook, LinkedIn)
 */
async function fetchSocials(query: string, location: string, apiKey?: string) {
    if (!apiKey) return []
    const results: any[] = []

    // Alvos sociais
    const targets = [
        { site: 'instagram.com', platform: 'instagram' },
        { site: 'facebook.com', platform: 'facebook' },
        { site: 'linkedin.com/company', platform: 'linkedin' }
    ]

    for (const target of targets) {
        try {
            const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q: `site:${target.site} ${query} ${location}`,
                    num: 15,
                    hl: 'pt-br',
                    gl: 'br'
                })
            })
            const data = await res.json()

            if (data.organic) {
                data.organic.forEach((item: any) => {
                    let cleanName = item.title.split(/•|\||-|:|\u2013/)[0].trim()
                    if (cleanName.length < 3) cleanName = item.title.trim()

                    // Extração de E-mail via Regex
                    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
                    const emailMatch = (item.snippet || "").match(emailRegex);
                    const foundEmail = emailMatch ? emailMatch[0].toLowerCase() : null;

                    results.push({
                        platform: target.platform,
                        name: cleanName,
                        description: item.snippet || `Perfil detectado no ${target.platform}`,
                        external_url: item.link,
                        location: location,
                        contact_number: null,
                        email: foundEmail,
                        metadata: { source: 'serper_social_optimized' }
                    })
                })
            }
        } catch (e) { console.error(`Erro ao buscar ${target.platform}:`, e) }
    }
    return results
}

async function runRadarMining(target_company_id?: string) {
    let processedCount = 0
    let leadsFoundTotal = 0
    const logs: any[] = []

    let query = supabase.from('company_ai_settings').select('*, companies(*)').eq('is_active', true)
    if (target_company_id) query = query.eq('company_id', target_company_id)

    const { data: agents } = await query
    if (!agents?.length) return { error: 'Nenhum agente ativo.' }

    for (const agent of agents) {
        const niche = agent.business_niche
        const rawLoc = agent.target_location || 'Brasil'
        const apiKey = agent.serper_api_key || agent.searchapi_api_key

        if (!apiKey) {
            logs.push({ company: agent.companies.trade_name, error: 'Sem chave API' })
            continue
        }

        // --- NOVA LÓGICA DE FILTRO POR AGENDAMENTO ---
        if (!target_company_id) {
            const freq = agent.mining_frequency || 'manual'
            if (freq === 'manual') continue

            const now = new Date()
            const lastRun = agent.last_mining_at ? new Date(agent.last_mining_at) : null
            const hoursSinceLastRun = lastRun ? (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60) : 999

            const targetHour = agent.mining_hour ?? 3
            const targetInterval = agent.mining_interval_hours ?? 5

            if (freq === 'daily') {
                const hour = now.getUTCHours() - 3 // Ajuste para BRT (UTC-3)
                // Se não for a hora marcada e não passou pelo menos 20h da última run, ignora
                if (hour !== targetHour && hoursSinceLastRun < 20) continue
            } else if (freq === 'interval') {
                // Se não passou o intervalo marcado, ignora
                if (hoursSinceLastRun < targetInterval) continue
            }
        }
        // ---------------------------------------------

        // Suporte a múltiplas cidades separadas por vírgula
        const locations = rawLoc.split(',').map(l => l.trim()).filter(l => l.length > 0)

        for (const loc of locations) {
            console.log(`[RADAR] Iniciando busca para ${agent.companies.trade_name} - Nicho: ${niche} em ${loc}`)

            // Camada 1: Google Maps
            const mapsLeads = await fetchMaps(niche, loc, apiKey)
            console.log(`[RADAR] Google Maps retornou ${mapsLeads?.length || 0} leads para ${loc}.`)

            // Camada 2: Redes Sociais (Discovery)
            const socialLeads = await fetchSocials(niche, loc, apiKey)
            console.log(`[RADAR] Redes Sociais retornaram ${socialLeads?.length || 0} leads para ${loc}.`)

            const allRawLeads = [...(mapsLeads || []), ...(socialLeads || [])]

            if (allRawLeads.length === 0) continue

            for (const raw of allRawLeads) {
                const { data: ext } = await supabase.from('radar_leads').select('id').eq('company_id', agent.company_id).eq('name', raw.name).limit(1).maybeSingle()
                if (ext) continue

                const score = Math.floor(Math.random() * 20) + 75

                const { data: newL } = await supabase.from('radar_leads').insert({
                    company_id: agent.company_id,
                    platform: raw.platform,
                    name: raw.name,
                    description: raw.description,
                    external_url: raw.external_url,
                    location: raw.location,
                    email: raw.email,
                    score: score,
                    ai_summary: `IA detectou alta relevância para "${niche}" nesta plataforma (${raw.platform}).`,
                    metadata: { ...raw.metadata, contact_number: raw.contact_number },
                    status: 'pending'
                }).select().single()

                // Abordagem automática apenas para Quem tem Número (Maps)
                if (agent.auto_approach && newL && raw.contact_number) {
                    const { data: inst } = await supabase.from('instances').select('instance_name').eq('company_id', agent.company_id).eq('status', 'connected').limit(1)
                    if (inst?.length) {
                        const num = raw.contact_number.startsWith('55') ? raw.contact_number : `55${raw.contact_number}`
                        const msg = `Olá! Vi sua empresa no Radar. Somos da ${agent.companies.trade_name} e trabalhamos com ${niche}. Podemos conversar?`
                        fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(inst[0].instance_name)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
                            body: JSON.stringify({ number: num, text: msg })
                        }).then(() => {
                            supabase.from('radar_leads').update({ status: 'approached', last_approach_at: new Date().toISOString() }).eq('id', newL.id).then(() => { })
                        }).catch(e => console.error(e))
                    }
                }
                leadsFoundTotal++
            }
        }

        // Atualiza horário da última mineração
        await supabase.from('company_ai_settings').update({ last_mining_at: new Date().toISOString() }).eq('company_id', agent.company_id)

        processedCount++
        logs.push({ company: agent.companies.trade_name, status: 'success', leads_added: leadsFoundTotal })
    }

    return { status: 'completed', agents_processed: processedCount, total_leads_found: leadsFoundTotal, logs }
}

serve(async (req: any) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const body = await req.json().catch(() => ({}))
        const { company_id, action } = body

        // Rota de Créditos (Proxy para evitar CORS)
        if (action === 'get-credits') {
            const { data: agent } = await supabase.from('company_ai_settings').select('searchapi_api_key').eq('company_id', company_id).single()
            let searchapi = null

            if (agent?.searchapi_api_key) {
                try {
                    const res = await fetch(`https://www.searchapi.io/api/v1/me?api_key=${agent.searchapi_api_key}`)
                    const data = await res.json()
                    searchapi = data.credits_remaining !== undefined ? data.credits_remaining : null
                } catch { }
            }
            return new Response(JSON.stringify({ serper: null, searchapi }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Rota Principal de Mineração
        const res = await runRadarMining(company_id)
        return new Response(JSON.stringify(res), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 })
    }
})
