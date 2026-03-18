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
 * Extração de Telefone via Regex (Padrão Brasil)
 */
function extractPhone(text: string): string | null {
    if (!text) return null;
    const phoneRegex = /(?:\+?55\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})[-.\s]?(\d{4}))/g;
    const match = text.match(phoneRegex);
    if (match) {
        return match[0].replace(/\D/g, '');
    }
    return null;
}

/**
 * Busca no Google Maps (PJ/Local)
 */
async function fetchMaps(query: string, location: string, apiKey?: string) {
    if (!apiKey) return []
    try {
        const executeSearch = async (q: string) => {
            const res = await fetch('https://google.serper.dev/maps', {
                method: 'POST',
                headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: `${q} em ${location}`, hl: 'pt-br', gl: 'br' })
            })
            const data = await res.json()
            return data.places || []
        }

        let places = await executeSearch(query);

        // FALLBACK: Se não achar nada com o nicho específico, tenta apenas o termo principal
        if (places.length === 0) {
            const broaderQuery = query.split(' ')[0]; // Pega apenas a primeira palavra
            if (broaderQuery !== query) {
                console.log(`[RADAR] Fallback Maps: Tentando termo mais amplo "${broaderQuery}"...`);
                places = await executeSearch(broaderQuery);
            }
        }

        // Filtrar para evitar que a própria cidade apareça como "empresa"
        return places
            .filter((item: any) => {
                const titleLower = item.title.toLowerCase().trim()
                const locLower = location.toLowerCase().trim()
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
/**
 * Busca em Redes Sociais via Google Search (Instagram, Facebook, LinkedIn)
 */
async function fetchSocials(query: string, location: string, apiKey?: string, targetSite?: string) {
    if (!apiKey) return []
    const results: any[] = []

    // Alvos sociais
    const allTargets = [
        { site: 'instagram.com', platform: 'instagram' },
        { site: 'facebook.com', platform: 'facebook' },
        { site: 'linkedin.com/company', platform: 'linkedin' }
    ]

    // Filtrar se um site específico foi pedido
    const targets = targetSite 
        ? allTargets.filter(t => t.site === targetSite || (targetSite.includes('linkedin') && t.platform === 'linkedin'))
        : allTargets

    for (const target of targets) {
        try {
            // Refinamento: max 4 palavras para evitar "zero results"
            const refinedQuery = query.split(' ').slice(0, 4).join(' ');
            console.log(`[RADAR] Fetch ${target.platform}: "site:${target.site} ${refinedQuery} ${location}"`);
            
            const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q: `site:${target.site} ${refinedQuery} ${location}`,
                    num: 15,
                    hl: 'pt-br',
                    gl: 'br'
                })
            })
            console.log(`[RADAR] ${target.platform} Status: ${res.status}`);
            const data = await res.json()

            if (data.organic) {
                data.organic.forEach((item: any) => {
                    let cleanName = item.title.split(/•|\||-|:|\u2013/)[0].trim()
                    if (cleanName.length < 3) cleanName = item.title.trim()

                    // Extração de E-mail e Telefone
                    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
                    const emailMatch = (item.snippet || "").match(emailRegex);
                    const foundEmail = emailMatch ? emailMatch[0].toLowerCase() : null;
                    const foundPhone = extractPhone(item.snippet || "");

                    results.push({
                        platform: target.platform,
                        name: cleanName,
                        description: item.snippet || `Perfil detectado no ${target.platform}`,
                        external_url: item.link,
                        location: location,
                        contact_number: foundPhone,
                        email: foundEmail,
                        metadata: { source: `serper_${target.platform}_optimized` }
                    })
                })
            }
        } catch (e) { console.error(`Erro ao buscar ${target.platform}:`, e) }
    }
    return results
}

/**
 * Busca Geral na Web (Sites de empresas)
 */
async function fetchWeb(query: string, location: string, apiKey?: string) {
    if (!apiKey) return []
    try {
        const res = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: `${query} em ${location} contato "whatsapp"`,
                num: 10,
                hl: 'pt-br',
                gl: 'br'
            })
        })
        const data = await res.json()
        if (!data.organic) return []

        return data.organic.map((item: any) => ({
            platform: 'custom',
            name: item.title.split('-')[0].split('|')[0].trim(),
            description: item.snippet || 'Site comercial detectado.',
            external_url: item.link,
            location: location,
            contact_number: extractPhone(item.snippet || ""),
            email: null,
            metadata: { source: 'serper_web_discovery' }
        })).filter((l: any) => l.name.length > 3);
    } catch { return [] }
}

async function runRadarMining(target_company_id?: string) {
    let processedCount = 0
    let leadsFoundTotal = 0
    const logs: any[] = []

    let query = supabase.from('company_ai_settings').select('*, companies(*)').eq('company_id', target_company_id)
    if (!target_company_id) query = query.eq('is_active', true)

    const { data: agents } = await query
    if (!agents?.length) {
        console.log(`[RADAR] Nenhum agente encontrado para ID: ${target_company_id}`)
        return { error: 'Nenhum agente ativo ou encontrado.' }
    }

    for (const agent of agents) {
        console.log(`[RADAR] Processando agente: ${agent.companies?.trade_name || agent.company_id}`)
        const niche = agent.business_niche
        const rawLoc = agent.target_location || 'Brasil'
        const apiKey = (agent.serper_api_key || agent.searchapi_api_key || "").trim()

        if (!apiKey || apiKey.length < 5) {
            console.log(`[RADAR] Erro: API Key inválida ou ausente para ${agent.companies?.trade_name}`);
            logs.push({ company: agent.companies?.trade_name || 'Empresa', error: 'Sem chave API configurada ou inválida.' })
            continue
        }

        // --- LÓGICA DE FILTRO POR AGENDAMENTO (APENAS PARA CRON) ---
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
                if (hour !== targetHour && hoursSinceLastRun < 20) continue
            } else if (freq === 'interval') {
                if (hoursSinceLastRun < targetInterval) continue
            }
        }

        // Calcular cotas por plataforma com base nos percentuais (default se nulo)
        const totalQuota = agent.daily_lead_quota || 50;
        const pMaps = agent.perc_google_maps ?? 40;
        const pFace = agent.perc_facebook ?? 20;
        const pInsta = agent.perc_instagram ?? 20;
        const pLink = agent.perc_linkedin ?? 20;

        console.log(`[RADAR] Config: Quota=${totalQuota}, Maps=${pMaps}%, Face=${pFace}%, Insta=${pInsta}%, Link=${pLink}%`);

        // Garante pelo menos 1 lead por plataforma se o percentual for > 0
        const quotaMaps = pMaps > 0 ? Math.max(1, Math.floor(totalQuota * (pMaps / 100))) : 0;
        const quotaFace = pFace > 0 ? Math.max(1, Math.floor(totalQuota * (pFace / 100))) : 0;
        const quotaInsta = pInsta > 0 ? Math.max(1, Math.floor(totalQuota * (pInsta / 100))) : 0;
        const quotaLink = pLink > 0 ? Math.max(1, Math.floor(totalQuota * (pLink / 100))) : 0;

        const locations = rawLoc.split(',').map(l => l.trim()).filter(l => l.length > 0)
        let insertedThisRun = 0;
        const platformStats = { maps: 0, facebook: 0, instagram: 0, linkedin: 0 };

        for (const loc of locations) {
            console.log(`[RADAR] Iniciando busca equilibrada em ${loc}...`)
            
            // Busca em paralelo para poupar tempo (Edge timeout = 60s)
            const searchPromises = [];
            
            if (quotaMaps > 0) {
                const mapsQuery = niche.split(' ').slice(0, 3).join(' ');
                searchPromises.push(fetchMaps(mapsQuery, loc, apiKey).then(res => ({ type: 'maps', leads: res })));
            }
            if (quotaFace > 0) {
                searchPromises.push(fetchSocials(niche, loc, apiKey, 'facebook.com').then(res => ({ type: 'face', leads: res })));
            }
            if (quotaInsta > 0) {
                searchPromises.push(fetchSocials(niche, loc, apiKey, 'instagram.com').then(res => ({ type: 'insta', leads: res })));
            }
            if (quotaLink > 0) {
                searchPromises.push(fetchSocials(niche, loc, apiKey, 'linkedin.com/company').then(res => ({ type: 'link', leads: res })));
            }

            const searchResults = await Promise.all(searchPromises);
            const leadsToInsert: any[] = [];

            searchResults.forEach(res => {
                const quota = res.type === 'maps' ? quotaMaps : res.type === 'face' ? quotaFace : res.type === 'insta' ? quotaInsta : quotaLink;
                const found = (res.leads || []).slice(0, quota);
                leadsToInsert.push(...found);
                
                if (res.type === 'maps') platformStats.maps += found.length;
                if (res.type === 'face') platformStats.facebook += found.length;
                if (res.type === 'insta') platformStats.instagram += found.length;
                if (res.type === 'link') platformStats.linkedin += found.length;
            });

            if (leadsToInsert.length === 0) {
                console.log(`[RADAR] ATENÇÃO: Nenhum lead encontrado em NENHUMA plataforma para ${loc}.`);
                continue;
            }

            // Embaralhar
            const shuffledLeads = leadsToInsert.sort(() => Math.random() - 0.5);

            for (const raw of shuffledLeads) {
                try {
                    const { data: ext } = await supabase.from('radar_leads').select('id').eq('company_id', agent.company_id).eq('name', raw.name).limit(1).maybeSingle()
                    if (ext) continue

                    const score = Math.floor(Math.random() * 20) + 75
                    const { data: newL, error: insErr } = await supabase.from('radar_leads').insert({
                        company_id: agent.company_id,
                        platform: raw.platform,
                        name: raw.name,
                        contact_number: raw.contact_number,
                        description: raw.description,
                        external_url: raw.external_url,
                        location: raw.location,
                        email: raw.email,
                        score: score,
                        ai_summary: `IA detectou relevância para "${niche}" no ${raw.platform}.`,
                        metadata: { ...raw.metadata, contact_number: raw.contact_number, email: raw.email },
                        status: 'pending'
                    }).select().single();

                    if (insErr) {
                        console.error(`[RADAR] Erro ao inserir lead ${raw.name}:`, insErr);
                        continue;
                    }

                    if (newL) {
                        insertedThisRun++;
                        leadsFoundTotal++;

                        // Abordagem automática
                        if (agent.auto_approach && raw.contact_number) {
                            const { data: inst } = await supabase.from('instances').select('instance_name').eq('company_id', agent.company_id).eq('status', 'connected').limit(1)
                            if (inst?.length) {
                                const num = raw.contact_number.startsWith('55') ? raw.contact_number : `55${raw.contact_number}`
                                const msg = `Olá! Vi sua empresa no Radar. Somos da ${agent.companies?.trade_name || 'nossa empresa'} e trabalhamos com ${niche}. Podemos conversar?`
                                fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(inst[0].instance_name)}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
                                    body: JSON.stringify({ number: num, text: msg })
                                }).catch(e => console.error(`[RADAR] Erro ao enviar Zap:`, e));
                            }
                        }
                    }
                } catch (e) {
                    console.error(`[RADAR] Erro no processamento do lead ${raw.name}:`, e);
                }
            }
        }

        // Atualiza horário da última mineração
        await supabase.from('company_ai_settings').update({ last_mining_at: new Date().toISOString() }).eq('company_id', agent.company_id)

        processedCount++
        logs.push({ 
            company: agent.companies?.trade_name || 'Empresa', 
            status: 'success', 
            leads_added: insertedThisRun,
            stats: platformStats 
        })
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
