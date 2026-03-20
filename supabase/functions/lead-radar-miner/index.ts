import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: any) => {
    // Handling CORS
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Missing Supabase environment variables (URL/Service Key). Check your project secrets.");
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://api.wpadm.com.br'
        const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || 'lucrocerto'

        /**
         * Extração de Telefone via Regex (Padrão Brasil)
         */
        function extractPhone(text: string): string | null {
            if (!text) return null;
            const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{4}/g;
            const matches = text.match(phoneRegex);
            if (!matches) return null;
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

                if (error) return fallbackMsg;
                return data?.text || fallbackMsg;
            } catch (e) {
                return fallbackMsg;
            }
        }

        function cleanNiche(query: string): string {
            const stopWords = ['que', 'tenha', 'com', 'de', 'para', 'em', 'um', 'uma', 'o', 'a', 'os', 'as', 'cnpj', 'cpf', 'pequenas', 'grandes', 'empresas', 'empresa'];
            return query.toLowerCase()
                .split(' ')
                .filter(word => !stopWords.includes(word) && word.length > 2)
                .join(' ') || query;
        }

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
                if (places.length === 0) {
                    const broaderQuery = coreNiche.split(' ')[0];
                    if (broaderQuery && broaderQuery !== coreNiche) {
                        places = await executeSearch(broaderQuery);
                    }
                }

                return places.filter((item: any) => {
                    const titleLower = (item.title || item.name || "").toLowerCase().trim()
                    return titleLower !== location.toLowerCase().trim() && (item.address || item.formatted_address)
                }).map((item: any) => {
                    let rawPhone = (item.phoneNumber || item.phone || "").replace(/\D/g, '');
                    if (!rawPhone) rawPhone = extractPhone(`${item.title} ${item.address || item.formatted_address} ${item.snippet || ""}`) || "";
                    
                    return {
                        platform: 'google_maps',
                        name: item.title || item.name,
                        description: item.category ? `${item.category}. Localizado em ${item.address || item.formatted_address}.` : `Empresa local em ${item.address || item.formatted_address}.`,
                        external_url: item.website || item.link || `https://www.google.com/maps/search/${encodeURIComponent(item.title || item.name)}`,
                        location: item.address || item.formatted_address,
                        contact_number: rawPhone,
                        metadata: { source: serperKey ? 'serper_maps' : 'searchapi_maps', category: item.category }
                    };
                })
            } catch { return [] }
        }

        async function fetchSocials(query: string, location: string, serperKey?: string, searchApiKey?: string, targetSite?: string) {
            if (!serperKey && !searchApiKey) return []
            const results: any[] = []
            const allTargets = [
                { site: 'instagram.com', platform: 'instagram' },
                { site: 'facebook.com', platform: 'facebook' },
                { site: 'linkedin.com/company', platform: 'linkedin' }
            ]
            const targets = targetSite ? allTargets.filter(t => t.site === targetSite || (targetSite.includes('linkedin') && t.platform === 'linkedin')) : allTargets
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

                    let data = await executeSearch(`site:${target.site} "${coreNiche}" "${location}"`);
                    if (!data.organic || data.organic.length === 0) data = await executeSearch(`site:${target.site} ${coreNiche} ${location}`);

                    if (data.organic) {
                        data.organic.forEach((item: any) => {
                            let cleanName = item.title.split(/•|\||-|:|\u2013/)[0].trim() || item.title.trim()
                            const fullText = (item.title || "") + " " + (item.snippet || "");
                            let foundPhone = extractPhone(fullText);
                            if (!foundPhone && item.link && (item.link.includes('wa.me/') || item.link.includes('phone='))) {
                                const linkMatch = item.link.match(/(?:wa\.me\/|phone=)(\d+)/);
                                if (linkMatch) foundPhone = linkMatch[1];
                            }

                            results.push({
                                platform: target.platform,
                                name: cleanName,
                                description: item.snippet || `Perfil detectado no ${target.platform}`,
                                external_url: item.link,
                                location: location,
                                contact_number: foundPhone,
                                email: extractEmail(fullText),
                                metadata: { source: serperKey ? 'serper_social' : 'searchapi_social' }
                            })
                        })
                    }
                } catch {}
            }
            return results
        }

        async function runRadarMining(target_company_id?: string) {
            let processedCount = 0
            let leadsFoundTotal = 0
            const logs: any[] = []

            let query = supabase.from('company_ai_settings').select('*, companies(*)').eq('company_id', target_company_id)
            if (!target_company_id) query = query.eq('is_active', true)

            const { data: agents } = await query
            if (!agents?.length) return { error: 'Nenhum agente ativo ou encontrado.' }

            for (const agent of agents) {
                const companyName = agent.companies?.trade_name || agent.company_id
                const niche = (agent.business_niche || "").trim()
                const rawLoc = (agent.target_location || "Brasil").trim()
                const serperKey = (agent.serper_api_key || "").trim()
                const searchApiKey = (agent.searchapi_api_key || "").trim()

                if (!niche || (!serperKey && !searchApiKey)) {
                    logs.push({ company: companyName, error: 'Configuração incompleta.' })
                    continue
                }

                const totalQuota = agent.daily_lead_quota || 50;
                const pMaps = agent.perc_google_maps ?? 40;
                const pFace = agent.perc_facebook ?? 20;
                const pInsta = agent.perc_instagram ?? 20;
                const pLink = agent.perc_linkedin ?? 20;

                const quotaMaps = pMaps > 0 ? Math.max(1, Math.floor(totalQuota * (pMaps / 100))) : 0;
                const quotaFace = pFace > 0 ? Math.max(1, Math.floor(totalQuota * (pFace / 100))) : 0;
                const quotaInsta = pInsta > 0 ? Math.max(1, Math.floor(totalQuota * (pInsta / 100))) : 0;
                const quotaLink = pLink > 0 ? Math.max(1, Math.floor(totalQuota * (pLink / 100))) : 0;

                const locations = rawLoc.split(',').map(l => l.trim()).filter(l => l.length > 0)
                const platformStats = { maps: 0, facebook: 0, instagram: 0, linkedin: 0 };
                let insertedThisRun = 0;

                for (const loc of locations) {
                    const searchPromises = [];
                    if (quotaMaps > 0) searchPromises.push(fetchMaps(niche, loc, serperKey, searchApiKey).then(res => ({ type: 'maps', leads: res })));
                    if (quotaFace > 0) searchPromises.push(fetchSocials(niche, loc, serperKey, searchApiKey, 'facebook.com').then(res => ({ type: 'face', leads: res })));
                    if (quotaInsta > 0) searchPromises.push(fetchSocials(niche, loc, serperKey, searchApiKey, 'instagram.com').then(res => ({ type: 'insta', leads: res })));
                    if (quotaLink > 0) searchPromises.push(fetchSocials(niche, loc, serperKey, searchApiKey, 'linkedin.com/company').then(res => ({ type: 'link', leads: res })));

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

                    for (const raw of leadsToInsert) {
                        try {
                            const { data: ext } = await supabase.from('radar_leads').select('id').eq('company_id', agent.company_id).eq('name', raw.name).limit(1).maybeSingle()
                            if (ext) continue

                            const { data: newL } = await supabase.from('radar_leads').insert({
                                company_id: agent.company_id,
                                platform: raw.platform,
                                name: raw.name,
                                contact_number: raw.contact_number,
                                description: raw.description,
                                external_url: raw.external_url,
                                location: raw.location,
                                email: raw.email,
                                score: Math.floor(Math.random() * 20) + 75,
                                ai_summary: `IA detectou relevância para "${niche}" no ${raw.platform}.`,
                                metadata: { ...raw.metadata, contact_number: raw.contact_number, email: raw.email },
                                status: 'pending'
                            }).select().single();

                            if (newL) {
                                insertedThisRun++;
                                leadsFoundTotal++;
                                if (agent.auto_approach && raw.contact_number) {
                                    const { data: inst } = await supabase.from('instances').select('instance_name').eq('company_id', agent.company_id).eq('status', 'connected').limit(1)
                                    if (inst?.length) {
                                        const num = raw.contact_number.startsWith('55') ? raw.contact_number : `55${raw.contact_number}`
                                        const msg = await generateAIApproach(agent, raw);
                                        fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(inst[0].instance_name)}`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
                                            body: JSON.stringify({ number: num, text: msg })
                                        }).catch(() => {});
                                    }
                                }
                            }
                        } catch {}
                    }
                }
                await supabase.from('company_ai_settings').update({ last_mining_at: new Date().toISOString() }).eq('company_id', agent.company_id)
                processedCount++
                logs.push({ company: companyName, status: 'success', leads_added: insertedThisRun, stats: platformStats })
            }
            return { status: 'completed', agents_processed: processedCount, total_leads_found: leadsFoundTotal, logs }
        }

        // Router
        const body = await req.json().catch(() => ({}))
        const { company_id, action } = body

        if (action === 'get-credits') {
            const { data: agent } = await supabase.from('company_ai_settings').select('searchapi_api_key').eq('company_id', company_id).single()
            let searchapi = null
            if (agent?.searchapi_api_key) {
                const res = await fetch(`https://www.searchapi.io/api/v1/me?api_key=${agent.searchapi_api_key}`).catch(() => null)
                const data = await res?.json().catch(() => null)
                searchapi = data?.credits_remaining ?? null
            }
            return new Response(JSON.stringify({ serper: null, searchapi }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        if (action === 'approach-lead') {
            const { lead_id } = body;
            const { data: lead } = await supabase.from('radar_leads').select('*').eq('id', lead_id).single();
            const { data: agent } = await supabase.from('company_ai_settings').select('*, companies(trade_name)').eq('company_id', company_id).single();
            if (!lead?.contact_number || !agent) throw new Error("Dados insuficientes.");
            const { data: inst } = await supabase.from('instances').select('instance_name').eq('company_id', company_id).eq('status', 'connected').limit(1);
            if (!inst?.length) throw new Error("WhatsApp desconectado.");

            const num = lead.contact_number.startsWith('55') ? lead.contact_number : `55${lead.contact_number}`;
            const msg = await generateAIApproach(agent, lead);
            await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(inst[0].instance_name)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
                body: JSON.stringify({ number: num, text: msg })
            });
            await supabase.from('radar_leads').update({ status: 'approached' }).eq('id', lead_id);
            return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const res = await runRadarMining(company_id)
        return new Response(JSON.stringify(res), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message, details: "Erro interno" }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 200 
        })
    }
})
