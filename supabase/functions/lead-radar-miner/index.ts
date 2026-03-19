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
    // Regex mais abrangente para padrões brasileiros e internacionais
    // Brasil: (84) 99999-9999, 84999999999
    // EUA/Global: (405) 843-1234, +1 405..., 4058431234
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{4}/g;
    const matches = text.match(phoneRegex);
    if (!matches) return null;
    
    // Pega o primeiro match longo o suficiente para ser um fone (8 a 15 dígitos)
    for (const m of matches) {
        const clean = m.replace(/\D/g, '');
        if (clean.length >= 8 && clean.length <= 15) return clean;
    }
    return null;
}
function extractEmail(text: string): string | null {
    if (!text) return null;
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const match = text.match(emailRegex);
    return match ? match[0].toLowerCase() : null;
}

async function generateAIApproach(agent: any, lead: any): Promise<string> {
    const companyObj = Array.isArray(agent.companies) ? agent.companies[0] : agent.companies;
    const companyName = companyObj?.trade_name || 'nossa empresa';
    const niche = agent.business_niche || 'seu segmento';
    const fallbackMsg = `Olá! Vi sua empresa no Radar. Somos da ${companyName} e trabalhamos com ${niche}. Podemos conversar?`;

    try {
        const businessDesc = agent.business_description || 'empresa de tecnologia e serviços';
        const leadName = lead.name || 'Empresa';
        const leadBio = lead.description || lead.snippet || 'sem descrição disponível';

        console.log(`[RADAR] Chamando IA: ${leadName} | Empresa: ${companyName}`);

        const { data, error } = await supabase.functions.invoke('lead-radar-magic', {
            body: {
                mode: 'field_only',
                input: `Você é um consultor de vendas especializado em prospecção via WhatsApp. 
REQUISITO: Gerar uma primeira abordagem curta, amigável e MUITO profissional.

MINHA EMPRESA: "${companyName}"
O QUE FAZEMOS: "${businessDesc}"
NOSSO NICHO: "${niche}"

O LEAD É: "${leadName}"
O QUE SABEMOS DELES: "${leadBio}"

REGRAS:
1. Saudação natural.
2. Seja direto e mencione que a "${companyName}" pode ajudar com base no contexto.
3. Máximo 280 caracteres.
4. Retorne APENAS o JSON com a chave "text".`
            }
        });

        if (error) {
            console.error(`[RADAR] Erro no invoke:`, error);
            return fallbackMsg;
        }

        if (!data?.text) {
            console.warn(`[RADAR] IA sem campo 'text'`);
            return fallbackMsg;
        }

        console.log(`[RADAR] Abordagem IA gerada com sucesso para ${leadName}`);
        return data.text;
    } catch (e) {
        console.error("[RADAR] Erro fatal ao gerar mensagem com IA:", e);
        return fallbackMsg;
    }
}

/**
 * Busca no Google Maps (PJ/Local)
 */
async function fetchMaps(query: string, location: string, serperKey?: string, searchApiKey?: string) {
    if (!serperKey && !searchApiKey) return []
    try {
        const coreNiche = cleanNiche(query);
        const executeSearch = async (q: string) => {
            if (serperKey) {
                const res = await fetch('https://google.serper.dev/maps', {
                    method: 'POST',
                    headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: `${q} em ${location}`, hl: 'pt-br', gl: 'br' })
                })
                const data = await res.json()
                return data.places || []
            } else {
                const res = await fetch(`https://www.searchapi.io/api/v1/search?engine=google_maps&q=${encodeURIComponent(q + ' em ' + location)}&api_key=${searchApiKey}`)
                const data = await res.json()
                return data.places || []
            }
        }

        let places = await executeSearch(coreNiche);

        // FALLBACK: Se não achar nada com o nicho limpo, tenta a primeira palavra
        if (places.length === 0) {
            const broaderQuery = coreNiche.split(' ')[0];
            if (broaderQuery && broaderQuery !== coreNiche) {
                console.log(`[RADAR] Fallback Maps: Tentando termo principal "${broaderQuery}"...`);
                places = await executeSearch(broaderQuery);
            }
        }

        return places
            .filter((item: any) => {
                const titleLower = (item.title || item.name || "").toLowerCase().trim()
                const locLower = location.toLowerCase().trim()
                // Evita pegar a própria cidade como lead
                return titleLower !== locLower && (item.address || item.formatted_address)
            })
            .map((item: any) => {
                const description = item.category ? `${item.category}. Localizado em ${item.address || item.formatted_address}.` : `Empresa local em ${item.address || item.formatted_address}.`;
                let rawPhone = (item.phoneNumber || item.phone || "").replace(/\D/g, '');
                
                // Fallback: Tenta extrair da descrição/snippet/título/endereço se vier vazio
                if (!rawPhone) {
                    const combined = `${item.title} ${item.address || item.formatted_address} ${item.snippet || ""}`;
                    rawPhone = extractPhone(combined) || "";
                    if (rawPhone) console.log(`[RADAR] Telefone extraído via Regex para ${item.title}: ${rawPhone}`);
                }

                return {
                    platform: 'google_maps',
                    name: item.title || item.name,
                    description: description,
                    external_url: item.website || item.link || `https://www.google.com/maps/search/${encodeURIComponent(item.title || item.name)}`,
                    location: item.address || item.formatted_address,
                    contact_number: rawPhone,
                    metadata: { source: serperKey ? 'serper_maps' : 'searchapi_maps', category: item.category, rating: item.rating }
                };
            })
    } catch (e) { console.error('[RADAR] Erro fetchMaps:', e); return [] }
}

function cleanNiche(query: string): string {
    const stopWords = ['que', 'tenha', 'com', 'de', 'para', 'em', 'um', 'uma', 'o', 'a', 'os', 'as', 'cnpj', 'cpf', 'pequenas', 'grandes', 'empresas', 'empresa'];
    return query.toLowerCase()
        .split(' ')
        .filter(word => !stopWords.includes(word) && word.length > 2)
        .join(' ') || query;
}

async function fetchSocials(query: string, location: string, serperKey?: string, searchApiKey?: string, targetSite?: string) {
    if (!serperKey && !searchApiKey) return []
    const results: any[] = []

    const allTargets = [
        { site: 'instagram.com', platform: 'instagram' },
        { site: 'facebook.com', platform: 'facebook' },
        { site: 'linkedin.com/company', platform: 'linkedin' }
    ]

    const targets = targetSite 
        ? allTargets.filter(t => t.site === targetSite || (targetSite.includes('linkedin') && t.platform === 'linkedin'))
        : allTargets

    const coreNiche = cleanNiche(query);

    for (const target of targets) {
        try {
            const executeSearch = async (currentQ: string) => {
                if (serperKey) {
                    const res = await fetch('https://google.serper.dev/search', {
                        method: 'POST',
                        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ q: currentQ, num: 15, hl: 'pt-br', gl: 'br' })
                    })
                    return await res.json()
                } else {
                    const res = await fetch(`https://www.searchapi.io/api/v1/search?q=${encodeURIComponent(currentQ)}&api_key=${searchApiKey}`)
                    return await res.json()
                }
            }

            // Tenta busca 1: Nicho limpo + Localização (com aspas para precisão)
            let q = `site:${target.site} "${coreNiche}" "${location}"`;
            console.log(`[RADAR] Fetch ${target.platform}: "${q}"`);
            let data = await executeSearch(q);

            // FALLBACK 1: Se zero resultados, tenta sem aspas
            if (!data.organic || data.organic.length === 0) {
                console.log(`[RADAR] Fallback 1 ${target.platform}: Tentando sem aspas...`);
                data = await executeSearch(`site:${target.site} ${coreNiche} ${location}`);
            }

            // FALLBACK 2: Se ainda zero, tenta apenas o termo principal do nicho + localização
            if (!data.organic || data.organic.length === 0) {
                const firstWord = coreNiche.split(' ')[0];
                if (firstWord && firstWord !== coreNiche) {
                    console.log(`[RADAR] Fallback 2 ${target.platform}: Tentando termo principal "${firstWord}"...`);
                    data = await executeSearch(`site:${target.site} ${firstWord} ${location}`);
                }
            }

            if (data.organic) {
                data.organic.forEach((item: any) => {
                    let cleanName = item.title.split(/•|\||-|:|\u2013/)[0].trim()
                    if (cleanName.length < 3) cleanName = item.title.trim()

                    // Extração agressiva: Snippet + Título
                    const fullText = (item.title || "") + " " + (item.snippet || "");
                    const foundEmail = extractEmail(fullText);
                    let foundPhone = extractPhone(fullText);

                    // Tenta extrair do LINK (comum em perfis que põem o wa.me na bio)
                    if (!foundPhone && item.link) {
                        if (item.link.includes('wa.me/') || item.link.includes('api.whatsapp.com/send')) {
                            const linkMatch = item.link.match(/(?:wa\.me\/|phone=)(\d+)/);
                            if (linkMatch) {
                                foundPhone = linkMatch[1];
                                console.log(`[RADAR] WhatsApp extraído do LINK: ${foundPhone}`);
                            }
                        }
                    }

                    results.push({
                        platform: target.platform,
                        name: cleanName,
                        description: item.snippet || `Perfil detectado no ${target.platform}`,
                        external_url: item.link,
                        location: location,
                        contact_number: foundPhone,
                        email: foundEmail,
                        metadata: { source: serperKey ? 'serper_social' : 'searchapi_social' }
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
        const companyName = agent.companies?.trade_name || agent.company_id
        console.log(`[RADAR] Processando agente: ${companyName}`)
        
        const niche = (agent.business_niche || "").trim()
        const rawLoc = (agent.target_location || "Brasil").trim()
        const serperKey = (agent.serper_api_key || "").trim()
        const searchApiKey = (agent.searchapi_api_key || "").trim()

        if (!niche) {
            console.log(`[RADAR] Erro: Nicho de negócio não configurado para ${companyName}`);
            logs.push({ company: companyName, error: 'Por favor, preencha o Nicho de Negócio nas configurações.' })
            continue
        }

        if (!serperKey && !searchApiKey) {
            console.log(`[RADAR] Erro: Nenhuma API Key configurada para ${companyName}`);
            logs.push({ company: companyName, error: 'Sem chave API configurada.' })
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

        const totalQuota = agent.daily_lead_quota || 50;
        const pMaps = agent.perc_google_maps ?? 40;
        const pFace = agent.perc_facebook ?? 20;
        const pInsta = agent.perc_instagram ?? 20;
        const pLink = agent.perc_linkedin ?? 20;

        console.log(`[RADAR] Config: Quota=${totalQuota}, Maps=${pMaps}%, Face=${pFace}%, Insta=${pInsta}%, Link=${pLink}%`);

        const quotaMaps = pMaps > 0 ? Math.max(1, Math.floor(totalQuota * (pMaps / 100))) : 0;
        const quotaFace = pFace > 0 ? Math.max(1, Math.floor(totalQuota * (pFace / 100))) : 0;
        const quotaInsta = pInsta > 0 ? Math.max(1, Math.floor(totalQuota * (pInsta / 100))) : 0;
        const quotaLink = pLink > 0 ? Math.max(1, Math.floor(totalQuota * (pLink / 100))) : 0;

        const locations = rawLoc.split(',').map(l => l.trim()).filter(l => l.length > 0)
        let insertedThisRun = 0;
        const platformStats = { maps: 0, facebook: 0, instagram: 0, linkedin: 0 };

        for (const loc of locations) {
            console.log(`[RADAR] Iniciando busca equilibrada em ${loc}...`)
            const searchPromises = [];
            
            if (quotaMaps > 0) {
                const mapsQuery = niche.split(' ').slice(0, 3).join(' ');
                searchPromises.push(fetchMaps(mapsQuery, loc, serperKey, searchApiKey).then(res => ({ type: 'maps', leads: res })));
            }
            if (quotaFace > 0) {
                searchPromises.push(fetchSocials(niche, loc, serperKey, searchApiKey, 'facebook.com').then(res => ({ type: 'face', leads: res })));
            }
            if (quotaInsta > 0) {
                searchPromises.push(fetchSocials(niche, loc, serperKey, searchApiKey, 'instagram.com').then(res => ({ type: 'insta', leads: res })));
            }
            if (quotaLink > 0) {
                searchPromises.push(fetchSocials(niche, loc, serperKey, searchApiKey, 'linkedin.com/company').then(res => ({ type: 'link', leads: res })));
            }

            const searchResults = await Promise.all(searchPromises);
            const leadsToInsert: any[] = [];

            searchResults.forEach(res => {
                const quota = res.type === 'maps' ? quotaMaps : res.type === 'face' ? quotaFace : res.type === 'insta' ? quotaInsta : quotaLink;
                const foundCount = (res.leads || []).length;
                console.log(`[RADAR] ${res.type} bruto: ${foundCount} encontrados. Cota: ${quota}`);
                
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
                                const msg = await generateAIApproach(agent, raw);

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

        // Rota de Teste Simples
        if (action === 'ping') {
            return new Response(JSON.stringify({ status: 'pong', time: new Date().toISOString() }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

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

        // Rota de Abordagem Individual
        if (action === 'approach-lead') {
            const { lead_id } = body;
            if (!lead_id) throw new Error("ID do lead não fornecido.");

            // 1. Busca dados do lead e do agente
            const { data: lead, error: leadErr } = await supabase.from('radar_leads').select('*').eq('id', lead_id).single();
            if (leadErr || !lead) throw new Error("Lead não encontrado.");

            const { data: agent, error: agentErr } = await supabase.from('company_ai_settings').select('*, companies(trade_name)').eq('company_id', company_id).single();
            if (agentErr || !agent) throw new Error("Configurações do agente não encontradas.");

            if (!lead.contact_number) throw new Error("Este lead não possui número de contato.");

            // 2. Busca instância conectada
            const { data: inst } = await supabase.from('instances').select('instance_name').eq('company_id', company_id).eq('status', 'connected').limit(1);
            if (!inst?.length) throw new Error("Nenhuma instância de WhatsApp conectada encontrada.");

            // 3. Envia mensagem
            let cleanNum = lead.contact_number.replace(/\D/g, '');
            if (cleanNum.startsWith('0')) cleanNum = cleanNum.substring(1);
            
            const num = cleanNum.startsWith('55') ? cleanNum : `55${cleanNum}`;
            const msg = await generateAIApproach(agent, lead);
            
            const evoRes = await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(inst[0].instance_name)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
                body: JSON.stringify({ number: num, text: msg })
            });

            if (!evoRes.ok) {
                const errData = await evoRes.json().catch(() => ({}));
                throw new Error(`Erro no WhatsApp: ${JSON.stringify(errData)}`);
            }

            // 4. Marca como abordado
            await supabase.from('radar_leads').update({ status: 'approached' }).eq('id', lead_id);

            return new Response(JSON.stringify({ status: 'success', message: 'Abordagem enviada com sucesso!' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Rota Principal de Mineração
        const res = await runRadarMining(company_id)
        return new Response(JSON.stringify(res), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    } catch (e: any) {
        console.error(`[RADAR] Erro Fatal na Edge Function:`, e);
        return new Response(JSON.stringify({ 
            error: e.message, 
            stack: e.stack,
            details: "Erro interno na Edge Function lead-radar-miner"
        }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 200 
        })
    }
})
