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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const birthdayTemplates = [
    "🎈 *PARABÉNS!* 🥳\n\nOlá, *{name}*!\n\nTudo bem? Hoje é o seu dia e a equipe da *{company}* não poderia deixar passar em branco! Desejamos a você muita saúde, paz e felicidades. 🎉🥂",
    "⭐ *DIA DE FESTA!* 🎂\n\nOi, *{name}*! Passando em nome da *{company}* para te desejar um aniversário incrível! Que este seu novo ciclo seja repleto de conquistas e alegrias. Aproveite muito o seu dia! 🎊🎁",
    "🎁 *FELIZ ANIVERSÁRIO!* 🎈\n\nGrande *{name}*! A equipe da *{company}* deseja a você um dia fantástico! Que seu ano seja maravilhoso e cheio de boas surpresas. Parabéns! 🥂✨"
];

const randomEmojis = ["✨", "🥂", "🎉", "🔥", "🚀", "🎊", "🎂", "🎈"];

async function sendWhatsApp(instanceName: string, targetNumber: string, text: string) {
    const typingTime = Math.floor(Math.random() * (5000 - 2000 + 1) + 2000); // Digitando entre 2 e 5 segundos

    const response = await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
        body: JSON.stringify({
            number: targetNumber,
            options: { delay: typingTime, presence: "composing" },
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

        console.log(`--- [STEALTH MODE] Lembrete de Aniversário (${currentDay}/${currentMonth}) ---`)

        const { data: companies, error: compError } = await supabase
            .from('companies')
            .select('id, trade_name, settings')
            .is('settings->automation_birthday_reminders', true)

        if (compError) throw compError

        const activeCompanies = company_id
            ? companies?.filter(c => c.id === company_id)
            : companies || []

        for (const comp of activeCompanies) {
            // Delay de Jitter inicial entre empresas (1 a 10 segundos)
            await sleep(Math.floor(Math.random() * 10000));

            const { data: members } = await supabase.from('company_members').select('user_id').eq('company_id', comp.id)
            const userIds = members?.map(m => m.user_id) || []

            const { data: allContacts } = await supabase
                .from('contacts')
                .select('*')
                .in('user_id', userIds)
                .not('birthday', 'is', null)

            const todaysBirthdays = allContacts?.filter(c => {
                if (!c.birthday) return false
                const bDate = new Date(c.birthday + 'T00:00:00Z');
                return (bDate.getUTCMonth() + 1) === currentMonth && bDate.getUTCDate() === currentDay
            }) || []

            if (todaysBirthdays.length === 0) continue

            const { data: waInstances } = await supabase.from('instances').select('instance_name').eq('company_id', comp.id).eq('status', 'connected').limit(1)
            const instanceName = waInstances?.[0]?.instance_name
            if (!instanceName) continue

            for (const contact of todaysBirthdays) {
                const rawNumber = contact.whatsapp || contact.phone;
                if (!rawNumber) continue

                // Delay Humano real: entre 20 e 50 segundos entre um contato e outro
                const humanDelay = Math.floor(Math.random() * (50000 - 20000 + 1) + 20000);
                await sleep(humanDelay);

                // Escolhe um modelo aleatório e adiciona um emoji aleatório no final
                let message = '';
                const customTemplate = comp.settings?.automation_birthday_template;

                if (customTemplate) {
                    message = customTemplate.replace('{name}', contact.name.split(' ')[0]);
                } else {
                    message = birthdayTemplates[Math.floor(Math.random() * birthdayTemplates.length)];
                    message = message.replace('{name}', contact.name.split(' ')[0])
                        .replace('{company}', comp.trade_name || 'nossa equipe');
                }

                message += " " + randomEmojis[Math.floor(Math.random() * randomEmojis.length)];

                const targetNumber = rawNumber.replace(/\D/g, '')
                if (targetNumber.length >= 10) {
                    await sendWhatsApp(instanceName, targetNumber, message)
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
