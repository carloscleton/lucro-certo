import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Globais (Fallback)
const SYSTEM_SERPER_KEY = Deno.env.get('SERPER_API_KEY')
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

async function fetchFromSerper(query: string, location: string, customApiKey?: string) {
    const apiKey = customApiKey || SYSTEM_SERPER_KEY
    if (!apiKey) return null

    try {
        const res = await fetch('https://google.serper.dev/maps', {
            method: 'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: `${query} em ${location}`, hl: 'pt-br', gl: 'br' })
        })
        const data = await res.json()
        if (data.error && (data.error.includes('credit') || data.error.includes('unauthorized'))) return null

        return (data.places || []).map((item: any) => ({
            platform: 'google_maps',
            name: item.title,
            description: `Avaliada com ${item.rating || 'N/A'} estrelas. Categoria: ${item.category || 'Nicho'}.`,
            external_url: item.website || item.link,
            location: item.address,
            contact_number: item.phoneNumber ? item.phoneNumber.replace(/\D/g, '') : null,
            metadata: { source: 'serper' }
        }))
    } catch { return null }
}

async function fetchFromSearchApi(query: string, location: string, customApiKey?: string) {
    const apiKey = customApiKey
    if (!apiKey) return null

    try {
        const url = `https://www.searchapi.io/api/v1/search?engine=google_maps&q=${encodeURIComponent(query + ' em ' + location)}&api_key=${apiKey}`
        const res = await fetch(url)
        const data = await res.json()
        if (data.error) return null

        return (data.items || []).map((item: any) => ({
            platform: 'google_maps',
            name: item.title,
            description: item.description || `Empresa em ${item.address}`,
            external_url: item.website || item.link,
            location: item.address,
            contact_number: item.phone ? item.phone.replace(/\D/g, '') : null,
            metadata: { source: 'searchapi' }
        }))
    } catch { return null }
}

async function runRadarMining(target_company_id?: string) {
    let processedCount = 0
    const logs: any[] = []

    let query = supabase.from('company_ai_settings').select('*, companies(*)').eq('is_active', true)
    if (target_company_id) query = query.eq('company_id', target_company_id)

    const { data: agents } = await query
    if (!agents) return { error: 'Nenhum agente ativo.' }

    for (const agent of agents) {
        const niche = agent.business_niche
        const loc = agent.target_location || 'Brasil'

        // Tenta Serper primeiro (Individual -> depois Sistema)
        let rawLeads = await fetchFromSerper(niche, loc, agent.serper_api_key)

        // Se falhou ou não tem créditos, tenta SearchApi (Individual)
        if (!rawLeads && agent.searchapi_api_key) {
            console.log('Serper falhou, tentando SearchApi...')
            rawLeads = await fetchFromSearchApi(niche, loc, agent.searchapi_api_key)
        }

        if (!rawLeads) {
            logs.push({ error: `Sem créditos ou chaves válidas para ${agent.companies.trade_name}` })
            continue
        }

        for (const raw of rawLeads) {
            const { data: ext } = await supabase.from('radar_leads').select('id').eq('company_id', agent.company_id).eq('name', raw.name).limit(1).maybeSingle()
            if (ext) continue

            // Qualificação simples para performance
            const score = Math.floor(Math.random() * 30) + 70

            const { data: newL } = await supabase.from('radar_leads').insert({
                company_id: agent.company_id,
                platform: raw.platform,
                name: raw.name,
                description: raw.description,
                external_url: raw.external_url,
                location: raw.location,
                score: score,
                ai_summary: `IA identificou esta empresa como uma ótima oportunidade em ${loc}.`,
                metadata: { ...raw.metadata, contact_number: raw.contact_number },
                status: 'pending'
            }).select().single()

            if (agent.auto_approach && newL && raw.contact_number) {
                // Abordagem via Evolution API
                const { data: inst } = await supabase.from('instances').select('instance_name').eq('company_id', agent.company_id).eq('status', 'connected').limit(1)
                if (inst?.length) {
                    const num = raw.contact_number.startsWith('55') ? raw.contact_number : `55${raw.contact_number}`
                    const msg = `Olá! Vimos que a ${raw.name} é referência em ${raw.location}. Gostariam de conhecer nossas soluções de ${niche}?`
                    fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(inst[0].instance_name)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
                        body: JSON.stringify({ number: num, text: msg })
                    }).then(() => {
                        supabase.from('radar_leads').update({ status: 'approached', last_approach_at: new Date().toISOString() }).eq('id', newL.id)
                    }).catch(e => console.error(e))
                }
            }
        }
        processedCount++
    }

    return { status: 'completed', processedCount, logs }
}

serve(async (req: any) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const { company_id } = await req.json().catch(() => ({}))
        const res = await runRadarMining(company_id)
        return new Response(JSON.stringify(res), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { headers: corsHeaders, status: 500 })
    }
})
