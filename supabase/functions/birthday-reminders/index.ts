import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sendWhatsApp(instanceName: string, targetNumber: string, text: string) {
    const response = await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
        body: JSON.stringify({
            number: targetNumber,
            options: { delay: 1200, presence: "composing" },
            textMessage: { text }
        })
    })
    return response.ok
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { company_id } = await req.json()
        const today = new Date()
        const currentMonth = today.getMonth() + 1
        const currentDay = today.getDate()

        console.log(`--- Iniciando Lembretes de Aniversário (${currentDay}/${currentMonth}) ---`)

        // 1. Buscar empresas que habilitaram automação de aniversário (ou filtrar por id se passado)
        const { data: companies, error: compError } = await supabase
            .from('companies')
            .select('id, trade_name, settings')
            .is('settings->automation_birthday_reminders', true)

        if (compError) throw compError

        const activeCompanies = company_id
            ? companies?.filter(c => c.id === company_id)
            : companies || []

        const overallResults = []

        for (const comp of activeCompanies) {
            console.log(`Processando aniversário para: ${comp.trade_name}`)

            const { data: members } = await supabase.from('company_members').select('user_id').eq('company_id', comp.id)
            const userIds = members?.map(m => m.user_id) || []

            const { data: allContacts } = await supabase
                .from('contacts')
                .select('*')
                .in('user_id', userIds)
                .not('birthday', 'is', null)

            const todaysBirthdays = allContacts?.filter(c => {
                if (!c.birthday) return false
                const b = new Date(c.birthday)
                // Usar getUTCDate para evitar problemas de fuso no banco
                const bDate = new Date(c.birthday + 'T00:00:00Z');
                return (bDate.getUTCMonth() + 1) === currentMonth && bDate.getUTCDate() === currentDay
            }) || []

            if (todaysBirthdays.length === 0) {
                console.log(`Nenhum aniversariante hoje na empresa ${comp.trade_name}`)
                continue
            }

            console.log(`${todaysBirthdays.length} aniversariante(s) na empresa ${comp.trade_name}`)

            // 3. Buscar instância conectada
            const { data: waInstances } = await supabase.from('instances').select('instance_name').eq('company_id', comp.id).eq('status', 'connected').limit(1)
            const instanceName = waInstances?.[0]?.instance_name
            if (!instanceName) {
                console.warn(`Empresa ${comp.trade_name} sem instância conectada para envio de aniversário.`)
                continue
            }

            for (const contact of todaysBirthdays) {
                if (!contact.phone) continue

                // Delay randômico entre 5 e 20 segundos para evitar bans em envios em massa
                const delayMillis = Math.floor(Math.random() * (20000 - 5000 + 1) + 5000);
                await sleep(delayMillis);

                const message = `🎈 *PARABÉNS!* 🥳\n\nOlá, *${contact.name}*!\n\nTudo bem? Hoje é o seu dia e a equipe da *${comp.trade_name}* não poderia deixar passar em branco!\n\nDesejamos a você muita saúde, paz, felicidades e sucesso em sua jornada. Que este novo ano de vida seja repleto de conquistas!\n\nUm grande abraço e aproveite muito o seu dia! 🎉🥂`

                const targetNumber = contact.phone.replace(/\D/g, '')
                if (targetNumber.length >= 10) {
                    const success = await sendWhatsApp(instanceName, targetNumber, message)
                    overallResults.push({ company: comp.trade_name, contact: contact.name, success })
                    console.log(`Mensagem de aniversário enviada para ${contact.name}: ${success ? 'SUCESSO' : 'ERRO'}`)
                }
            }
        }

        return new Response(JSON.stringify({
            processed: activeCompanies.length,
            sentCount: overallResults.length,
            details: overallResults
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        console.error('Erro aniversário:', error.message)
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
