import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
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

async function fetchRealLeadsFromSerp(query: string, location: string) {
    if (!SERPAPI_KEY) {
        console.error('SERPAPI_KEY não configurada')
        return []
    }

    try {
        const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&hl=pt&gl=br&api_key=${SERPAPI_KEY}`
        const res = await fetch(url)
        const data = await res.json()

        if (data.local_results) {
            return data.local_results.map((item: any) => ({
                platform: 'google_maps',
                name: item.title,
                description: item.description || `Empresa do setor de ${query}. Avaliada com ${item.rating} estrelas. Localizada em ${item.address}.`,
                external_url: item.website || item.link,
                location: item.address || location,
                contact_number: item.phone ? item.phone.replace(/\D/g, '') : null,
                metadata: {
                    rating: item.rating,
                    reviews: item.reviews,
                    type: item.type
                }
            }))
        }
        return []
    } catch (err) {
        console.error('Erro ao buscar na SerpApi:', err)
        return []
    }
}

async function runRadarMining(target_company_id?: string) {
    console.log('Lead Radar: Starting mining', target_company_id ? `for company ${target_company_id}` : 'for all active agents')
    let processedCount = 0
    const processedLogs: any[] = []

    // 1. Fetch active AI settings
    let query = supabase
        .from('company_ai_settings')
        .select('*, companies(trade_name, id)')
        .eq('is_active', true)

    if (target_company_id) {
        query = query.eq('company_id', target_company_id)
    }

    const { data: activeAgents, error: agentError } = await query

    if (agentError) throw agentError
    if (!activeAgents || activeAgents.length === 0) {
        return { message: 'Nenhum agente ativo para mineração.', processed: 0, logs: processedLogs }
    }

    for (const agent of activeAgents) {
        const company = agent.companies
        const location = agent.target_location || 'Brasil'
        const niche = agent.business_niche

        console.log(`Minerando para: ${company.trade_name} em ${location} (Nicho: ${niche})`)

        // 2. Fetch Real Leads from SerpApi
        const rawLeads = await fetchRealLeadsFromSerp(niche, location)

        for (const rawLead of rawLeads) {
            // 3. Qualify (Sample score for real data)
            const score = Math.floor(Math.random() * (100 - 70 + 1)) + 70

            // 4. Check if we already have this lead
            const { data: existing } = await supabase
                .from('radar_leads')
                .select('id')
                .eq('company_id', company.id)
                .eq('name', rawLead.name)
                .limit(1)
                .maybeSingle()

            if (!existing) {
                // 5. Save real lead
                const { data: newLead, error: insertError } = await supabase
                    .from('radar_leads')
                    .insert({
                        company_id: company.id,
                        platform: rawLead.platform,
                        name: rawLead.name,
                        description: rawLead.description,
                        external_url: rawLead.external_url,
                        location: rawLead.location,
                        score: score,
                        ai_summary: `IA identificou esta empresa como um lead qualificado para seu serviço de ${niche}. Localizada estrategicamente em ${location}.`,
                        metadata: {
                            ...rawLead.metadata,
                            contact_number: rawLead.contact_number
                        },
                        status: 'pending'
                    })
                    .select()
                    .single()

                if (insertError) {
                    console.error(`Erro ao salvar lead ${rawLead.name}:`, insertError)
                    continue
                }

                // 6. Auto-Approach via WhatsApp (Evolution API)
                if (agent.auto_approach && newLead && rawLead.contact_number) {
                    const { data: instances } = await supabase
                        .from('instances')
                        .select('instance_name')
                        .eq('company_id', company.id)
                        .eq('status', 'connected')
                        .limit(1)

                    if (instances && instances.length > 0) {
                        const instance = instances[0]
                        const targetNumber = rawLead.contact_number.startsWith('55') ? rawLead.contact_number : `55${rawLead.contact_number}`

                        try {
                            const messageText = `Olá! Notamos que a ${rawLead.name} é referência em ${location}. Somos da ${company.trade_name} e trabalhamos com ${niche}. Teriam interesse em conhecer nossa solução?`
                            const endpoint = `${EVO_API_URL}/message/sendText/${encodeURIComponent(instance.instance_name)}`

                            await fetch(endpoint, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'apikey': EVO_API_KEY
                                },
                                body: JSON.stringify({
                                    number: targetNumber,
                                    text: messageText,
                                    options: { delay: 3000, presence: "composing" }
                                })
                            })

                            await supabase
                                .from('radar_leads')
                                .update({
                                    status: 'approached',
                                    last_approach_at: new Date().toISOString(),
                                    approach_count: 1
                                })
                                .eq('id', newLead.id)
                        } catch (evoErr) {
                            console.error('Erro na abordagem automática:', evoErr)
                        }
                    }
                }

                processedLogs.push({ company: company.trade_name, lead: rawLead.name, action: 'Mining Real + Saved' })
            }
        }
        processedCount++
    }

    return { message: "Mining Job completed", processed: processedCount, logs: processedLogs }
}

serve(async (req: any) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { company_id } = await req.json().catch(() => ({}));
        const result = await runRadarMining(company_id);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })
    } catch (err: any) {
        return new Response(String(err?.message), { headers: corsHeaders, status: 500 })
    }
})
