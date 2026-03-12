import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configurações de Infraestrutura (IA e WhatsApp permanecem globais por ora)
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

/**
 * Busca no Google Maps usando a chave INDIVIDUAL do cliente via Serper.dev
 */
async function fetchFromSerper(query: string, location: string, apiKey?: string) {
    if (!apiKey) return null // NUNCA usar chave global

    try {
        const res = await fetch('https://google.serper.dev/maps', {
            method: 'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: `${query} em ${location}`, hl: 'pt-br', gl: 'br' })
        })
        const data = await res.json()

        // Verifica erro de crédito ou chave inválida
        if (data.error) {
            console.error(`Erro Serper [${apiKey.substring(0, 5)}...]:`, data.error)
            return null
        }

        return (data.places || []).map((item: any) => ({
            platform: 'google_maps',
            name: item.title,
            description: `Empresa em ${item.address}. Avaliação: ${item.rating || 'N/A'}.`,
            external_url: item.website || item.link || `https://www.google.com/maps/search/${encodeURIComponent(item.title)}`,
            location: item.address,
            contact_number: item.phoneNumber ? item.phoneNumber.replace(/\D/g, '') : null,
            metadata: { source: 'serper_client_key' }
        }))
    } catch (e) {
        console.error('Erro de rede Serper:', e)
        return null
    }
}

/**
 * Busca no Google Maps usando a chave INDIVIDUAL do cliente via SearchApi.io
 */
async function fetchFromSearchApi(query: string, location: string, apiKey?: string) {
    if (!apiKey) return null // NUNCA usar chave global

    try {
        const url = `https://www.searchapi.io/api/v1/search?engine=google_maps&q=${encodeURIComponent(query + ' em ' + location)}&api_key=${apiKey}`
        const res = await fetch(url)
        const data = await res.json()

        if (data.error) {
            console.error(`Erro SearchApi [${apiKey.substring(0, 5)}...]:`, data.error)
            return null
        }

        return (data.items || []).map((item: any) => ({
            platform: 'google_maps',
            name: item.title,
            description: item.description || `Empresa em ${item.address}`,
            external_url: item.website || item.link,
            location: item.address,
            contact_number: item.phone ? item.phone.replace(/\D/g, '') : null,
            metadata: { source: 'searchapi_client_key' }
        }))
    } catch (e) {
        console.error('Erro de rede SearchApi:', e)
        return null
    }
}

async function runRadarMining(target_company_id?: string) {
    let processedCount = 0
    let leadsFoundTotal = 0
    const logs: any[] = []

    let query = supabase.from('company_ai_settings').select('*, companies(*)').eq('is_active', true)
    if (target_company_id) query = query.eq('company_id', target_company_id)

    const { data: agents } = await query
    if (!agents || agents.length === 0) return { error: 'Nenhum agente configurado ou ativo.' }

    for (const agent of agents) {
        const niche = agent.business_niche
        const loc = agent.target_location || 'Brasil'

        // Bloqueio de Segurança: Se não tem chave, não minera.
        if (!agent.serper_api_key && !agent.searchapi_api_key) {
            logs.push({
                company: agent.companies.trade_name,
                status: 'error',
                message: 'Chaves de API ausentes. O cliente deve configurar no painel.'
            })
            continue
        }

        let rawLeads = null

        // 1. Tenta Serper do Cliente
        if (agent.serper_api_key) {
            rawLeads = await fetchFromSerper(niche, loc, agent.serper_api_key)
        }

        // 2. Fallback para SearchApi do Cliente (se a primeira falhar ou não existir)
        if (!rawLeads && agent.searchapi_api_key) {
            rawLeads = await fetchFromSearchApi(niche, loc, agent.searchapi_api_key)
        }

        if (!rawLeads || rawLeads.length === 0) {
            logs.push({
                company: agent.companies.trade_name,
                status: 'warning',
                message: 'Nenhum lead encontrado ou créditos esgotados nas chaves do cliente.'
            })
            continue
        }

        for (const raw of rawLeads) {
            // Evita duplicatas para a mesma empresa
            const { data: ext } = await supabase.from('radar_leads').select('id').eq('company_id', agent.company_id).eq('name', raw.name).limit(1).maybeSingle()
            if (ext) continue

            // Score randômico para simular validação (pode ser expandido com Gemini)
            const score = Math.floor(Math.random() * 20) + 75

            const { data: newL } = await supabase.from('radar_leads').insert({
                company_id: agent.company_id,
                platform: raw.platform,
                name: raw.name,
                description: raw.description,
                external_url: raw.external_url,
                location: raw.location,
                score: score,
                ai_summary: `Oportunidade detectada em ${loc} no segmento de ${niche}.`,
                metadata: { ...raw.metadata, contact_number: raw.contact_number },
                status: 'pending'
            }).select().single()

            // Abordagem Automática (se o cliente ativou e tem instância conectada)
            if (agent.auto_approach && newL && raw.contact_number) {
                const { data: inst } = await supabase.from('instances').select('instance_name').eq('company_id', agent.company_id).eq('status', 'connected').limit(1)
                if (inst?.length) {
                    const num = raw.contact_number.startsWith('55') ? raw.contact_number : `55${raw.contact_number}`
                    const msg = `Olá! Sou da ${agent.companies.trade_name}. Vimos sua atividade em ${raw.location} e achamos que podemos ajudar com ${niche}. Podemos conversar?`

                    fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(inst[0].instance_name)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
                        body: JSON.stringify({ number: num, text: msg })
                    }).then(() => {
                        supabase.from('radar_leads').update({ status: 'approached', last_approach_at: new Date().toISOString() }).eq('id', newL.id).then(() => { })
                    }).catch(e => console.error('Erro envio Zap:', e))
                }
            }
            leadsFoundTotal++
        }
        processedCount++
    }

    return {
        status: 'completed',
        agents_processed: processedCount,
        total_leads_found: leadsFoundTotal,
        logs
    }
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
