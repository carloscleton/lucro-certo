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
        const today = new Date()
        const currentMonth = today.getMonth() + 1
        const currentDay = today.getDate()

        console.log(`--- Iniciando Lembretes de Aniversário (${currentDay}/${currentMonth}) ---`)

        // 1. Buscar empresas que habilitaram automação de aniversário
        const { data: companies, error: compError } = await supabase
            .from('companies')
            .select('id, trade_name, settings')

        if (compError) throw compError

        const activeCompanies = companies?.filter(c => (c.settings as any)?.automation_birthday_reminders === true) || []

        const overallResults = []

        for (const comp of activeCompanies) {
            console.log(`Processando aniversário para: ${comp.trade_name}`)

            // 2. Buscar contatos da empresa que fazem aniversário hoje
            // Usamos extract para pegar apenas dia e mês
            const { data: birthdayContacts, error: contactError } = await supabase
                .from('contacts')
                .select('*')
                .eq('user_id', (await supabase.from('company_members').select('user_id').eq('company_id', comp.id).eq('role', 'owner').single()).data?.user_id)
            // Nota: A estrutura de 'user_id' nos contatos pode variar, mas assumimos que o dono da empresa é quem criou.
            // Melhoria: Filtrar por empresa se houvesse company_id nos contatos. 
            // Como o sistema usa user_id, vamos buscar os contatos dos membros da empresa.

            // Correção: Buscar todos os contatos vinculados aos membros dessa empresa
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
                return (b.getUTCMonth() + 1) === currentMonth && b.getUTCDate() === currentDay
            }) || []

            if (todaysBirthdays.length === 0) continue

            // 3. Buscar instância conectada
            const { data: waInstances } = await supabase.from('instances').select('instance_name').eq('company_id', comp.id).eq('status', 'connected').limit(1)
            const instanceName = waInstances?.[0]?.instance_name
            if (!instanceName) continue

            for (const contact of todaysBirthdays) {
                if (!contact.phone) continue

                const message = `🎈 *PARABÉNS!* 🥳\n\nOlá, *${contact.name}*!\n\nTudo bem? Hoje é o seu dia e a equipe da *${comp.trade_name}* não poderia deixar passar em branco!\n\nDesejamos a você muita saúde, paz, felicidades e sucesso em sua jornada. Que este novo ano de vida seja repleto de conquistas!\n\nUm grande abraço e aproveite muito o seu dia! 🎉🥂`

                const targetNumber = contact.phone.replace(/\D/g, '')
                if (targetNumber.length >= 10) {
                    const success = await sendWhatsApp(instanceName, targetNumber, message)
                    overallResults.push({ company: comp.trade_name, contact: contact.name, success })
                }
            }
        }

        return new Response(JSON.stringify({
            processed: activeCompanies.length,
            sentCount: overallResults.length,
            details: overallResults
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
