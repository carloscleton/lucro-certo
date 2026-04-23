import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Pegar a hora atual no fuso de Brasília (UTC-3)
        const formatter = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })

        const currentTime = formatter.format(new Date())
        const currentHour = currentTime.split(':')[0] // Ex: "08"

        console.log(`--- Dispatcher Automático: Verificando hora ${currentHour}:00 ---`)

        // 1. Buscar todas as empresas
        const { data: companies, error: compError } = await supabase
            .from('companies')
            .select('id, trade_name, settings')
            .not('settings', 'is', null)

        if (compError) throw compError

        const results = []

        for (const comp of companies) {
            try {
                const settings = comp.settings as any
                console.log(`[Dispatcher] Processando empresa: ${comp.trade_name} (${comp.id})`);

                // Verificação 1: Resumo Financeiro
                if (settings.automation_financial_reminders === true) {
                    const setTime = settings.automation_financial_time || '08:00'
                    const setHour = setTime.split(':')[0]

                    if (setHour === currentHour) {
                        console.log(`   [FINANCEIRO] Disparando para: ${comp.trade_name}`)
                        await supabase.functions.invoke('financial-reminders', {
                            body: { company_id: comp.id, days: 7 }
                        })
                        results.push(`${comp.trade_name}: Financeiro enviado`)
                    }
                }

                // Verificação 2: Aniversários
                if (settings.automation_birthday_reminders === true) {
                    const setTime = settings.automation_birthday_time || '09:00'
                    const setHour = setTime.split(':')[0]

                    if (setHour === currentHour) {
                        console.log(`   [ANIVERSÁRIO] Disparando para: ${comp.trade_name}`)
                        await supabase.functions.invoke('birthday-reminders', {
                            body: { company_id: comp.id }
                        })
                        results.push(`${comp.trade_name}: Aniversários enviado`)
                    }
                }

                // Verificação 3: Pagamentos Atrasados
                if (settings.automation_overdue_reminders === true) {
                    const setTime = settings.automation_overdue_time || '10:00'
                    const setHour = setTime.split(':')[0]

                    if (setHour === currentHour) {
                        console.log(`   [ATRASO] Disparando para: ${comp.trade_name}`)
                        await supabase.functions.invoke('overdue-reminders', {
                            body: { company_id: comp.id }
                        })
                        results.push(`${comp.trade_name}: Atrasos enviado`)
                    }
                }
            } catch (err: any) {
                console.error(`[Dispatcher] Erro ao processar empresa ${comp.trade_name}:`, err.message);
            }
        }

        // --- NOVO: Disparo das Rotinas de IA (Radar e Redes Sociais) ---
        // Estas funções já possuem lógica interna para respeitar o agendamento de cada empresa
        console.log(`[IA] Disparando Radar e Copilot para processamento agendado...`)

        // Dispara Radar de Leads (Mineração Global)
        await supabase.functions.invoke('lead-radar-miner', { body: {} })

        // Dispara Social Copilot (Postagens Automáticas)
        await supabase.functions.invoke('social-copilot-cron', { body: {} })

        return new Response(JSON.stringify({
            time: currentTime,
            processed: results.length,
            details: results
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        console.error('Erro no Dispatcher:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})

// Cron Trigger: Roda a cada 1 hora para processar agendamentos pendentes
if (typeof (Deno as any).cron === 'function') {
    (Deno as any).cron('Automation Dispatcher Hourly', '0 * * * *', async () => {
        try {
            console.log("Triggered by Deno Cron (Automation Dispatcher)");
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const client = createClient(supabaseUrl, supabaseServiceKey);
            
            // Simula o request para o próprio Dispatcher (ou chama a lógica interna se refatorado)
            // Para simplicidade aqui, chamamos a URL interna
            await fetch(`${supabaseUrl}/functions/v1/automation-dispatcher`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${supabaseServiceKey}` }
            });
        } catch (err) {
            console.error("Cron Error:", err);
        }
    })
}
