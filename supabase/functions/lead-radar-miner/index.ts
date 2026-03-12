import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

async function runRadarMining(target_company_id?: string) {
    console.log('Lead Radar: Starting mining', target_company_id ? `for company ${target_company_id}` : 'for all active agents')
    let processed = 0
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
        return { message: 'Nenhum agente ativo para mineração.', processed, logs: processedLogs }
    }

    for (const agent of activeAgents) {
        const company = agent.companies
        console.log(`Minerando para: ${company.trade_name} em ${agent.target_location || 'Brasil'}`)

        // 2. Simulated Lead Generation (Phase 1)
        // In a real scenario, this would call Serper.dev, Instagram Scraper, etc.
        const mockLeads = [
            {
                platform: 'instagram',
                name: 'Roberto Silva',
                description: 'Alguém indica uma empresa de TI em Natal para configurar rede e servidor?',
                external_url: 'https://instagram.com/p/it_prospect_1',
                location: agent.target_location || 'Brasil',
                contact_number: '5584999991234'
            },
            {
                platform: 'google_maps',
                name: 'Contabilidade Freitas',
                description: 'Escritório em crescimento precisando de suporte mensal para computadores e backup.',
                external_url: 'https://maps.google.com/contab_freitas',
                location: agent.target_location || 'Brasil',
                contact_number: '558432221234'
            }
        ]

        for (const rawLead of mockLeads) {
            // Ajusta a localização do mock para bater com a escolha do usuário para teste visual
            rawLead.location = agent.target_location || 'Brasil';

            // 3. Qualify with AI
            const qualificationPrompt = `
        Analise este lead para a empresa "${company.trade_name}".
        Nicho: ${agent.business_niche}
        Descrição: ${agent.business_description}
        Serviços: ${JSON.stringify(agent.services_catalog)}

        Lead encontrado em: ${rawLead.platform}
        O que o lead disse/é: ${rawLead.description}

        Responda em JSON:
        {
          "score": 0 a 100,
          "is_qualified": boolean,
          "ai_summary": "breve resumo do porquê",
          "approach_message": "primeira mensagem personalizada de abordagem via WhatsApp"
        }
      `

            // For now, let's assume highly qualified for testing
            const qualification = {
                score: 85,
                is_qualified: true,
                ai_summary: "Demonstrou interesse direto em exames rápidos, que é o forte da empresa.",
                approach_message: `Olá ${rawLead.name}! Vi que você está procurando por exames laboratoriais rápidos. Aqui no ${company.trade_name} entregamos resultados em até 24h. Gostaria de ver nossa tabela de preços?`
            }

            if (qualification.is_qualified) {
                // 4. Check if we already have this lead (Debounce/Deduplication)
                const { data: existing } = await supabase
                    .from('radar_leads')
                    .select('id')
                    .eq('company_id', company.id)
                    .eq('name', rawLead.name)
                    .limit(1)
                    .maybeSingle()

                if (!existing) {
                    // 5. Save lead
                    const { data: newLead, error: insertError } = await supabase
                        .from('radar_leads')
                        .insert({
                            company_id: company.id,
                            platform: rawLead.platform,
                            name: rawLead.name,
                            description: rawLead.description,
                            external_url: rawLead.external_url,
                            location: rawLead.location,
                            score: qualification.score,
                            ai_summary: qualification.ai_summary,
                            metadata: { approach_suggestion: qualification.approach_message },
                            status: 'pending'
                        })
                        .select()
                        .single()

                    if (insertError) {
                        console.error(`Erro ao salvar lead ${rawLead.name}:`, insertError)
                        continue
                    }

                    // 6. Auto-Approach via WhatsApp (Evolution API)
                    if (agent.auto_approach && newLead) {
                        // Fetch an active instance for this company
                        const { data: instances } = await supabase
                            .from('instances')
                            .select('instance_name')
                            .eq('company_id', company.id)
                            .eq('status', 'connected')
                            .limit(1)

                        if (instances && instances.length > 0) {
                            const instance = instances[0]
                            console.log(`Automatizando abordagem para ${rawLead.name} via ${instance.instance_name}`)

                            // Note: Here we'd need a real phone number. 
                            // For mock, let's use a dummy or skip if missing.
                            const targetNumber = '5511999999999' // rawLead.contact_number

                            try {
                                const messageText = qualification.approach_message
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
                                        options: { delay: 2000, presence: "composing" }
                                    })
                                })

                                // Update lead status
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

                    processedLogs.push({ company: company.trade_name, lead: rawLead.name, action: 'Mining + Saved' })
                } else {
                    processedLogs.push({ company: company.trade_name, lead: rawLead.name, action: 'Duplicate Ignored' })
                }
            }
        }
        processed++
    }

    return { message: "Mining Job completed", processed, logs: processedLogs }
}

serve(async (req) => {
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
