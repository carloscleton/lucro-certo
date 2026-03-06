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
        console.log('--- Iniciando Despachante de Automações ---')

        // 1. Buscar todas as empresas que habilitaram o resumo financeiro nas configurações
        // Filtramos pelo campo JSONB 'settings'
        const { data: companies, error: compError } = await supabase
            .from('companies')
            .select('id, trade_name, settings')
            .not('settings', 'is', null)

        if (compError) throw compError

        const activeCompanies = companies?.filter(c => (c.settings as any)?.automation_financial_reminders === true) || []

        console.log(`Encontradas ${activeCompanies.length} empresas com resumo financeiro ativo.`)

        const results = []

        // 2. Para cada empresa ativa, disparar a função de lembrete
        for (const comp of activeCompanies) {
            console.log(`Disparando para: ${comp.trade_name} (${comp.id})`)

            try {
                // Chamamos a função 'financial-reminders' internamente para cada empresa
                const { data, error } = await supabase.functions.invoke('financial-reminders', {
                    body: { company_id: comp.id, days: 7 }
                })

                results.push({
                    company: comp.trade_name,
                    success: !error,
                    message: data?.message || error?.message || 'Processado'
                })
            } catch (err) {
                console.error(`Erro ao disparar para ${comp.trade_name}:`, err)
                results.push({ company: comp.trade_name, success: false, error: err.message })
            }
        }

        return new Response(JSON.stringify({
            processed: activeCompanies.length,
            details: results
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Erro no Dispatcher:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
