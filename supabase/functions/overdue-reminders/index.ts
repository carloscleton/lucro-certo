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

const overdueTemplates = [
    "Olá {name}, notamos que a sua fatura na {company} ainda está pendente. 😊 Caso já tenha efetuado o pagamento, por favor ignore esta mensagem.",
    "Ei {name}! Passando para lembrar que sua fatura na {company} está com alguns dias de atraso. Precisando de ajuda ou de uma nova guia? Estamos à disposição!",
    "Oi {name}, tudo bem? Consta aqui uma pendência no sistema da {company}. Gostaríamos de regularizar para evitar juros ou suspensão de serviços. Podemos ajudar?",
]

const randomEmojis = ["💳", "💰", "🧾", "📝", "🏦", "🤝"];

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { company_id } = await req.json()
        if (!company_id) throw new Error('company_id is required')

        // 1. Get company info and settings
        const { data: comp } = await supabase.from('companies').select('trade_name, settings').eq('id', company_id).single()
        if (!comp) throw new Error('Company not found')

        // Check if automation is on
        if (comp.settings?.automation_overdue_reminders !== true) {
            return new Response(JSON.stringify({ message: 'Automation is off.' }), { headers: corsHeaders })
        }

        // 2. Find overdue invoices (type=income, status=pending, date < today - 3 days)
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const dateStr = threeDaysAgo.toISOString().split('T')[0];

        const { data: invoices, error: invError } = await supabase
            .from('transactions')
            .select('*, contact:contacts(name, phone, whatsapp)')
            .eq('company_id', company_id)
            .eq('type', 'income')
            .eq('status', 'pending')
            .lte('date', dateStr)
            .order('date', { ascending: true })

        if (invError) throw invError
        if (!invoices || invoices.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'Nenhuma fatura com atraso crítico.' }), { headers: corsHeaders })
        }

        // 3. Get Evolution Instance
        const { data: waInstances } = await supabase.from('instances')
            .select('instance_name')
            .eq('company_id', company_id)
            .eq('status', 'connected')
            .limit(1)

        const instanceName = waInstances?.[0]?.instance_name
        if (!instanceName) {
            return new Response(JSON.stringify({ error: 'Nenhuma instância WhatsApp conectada.' }), { status: 400, headers: corsHeaders })
        }

        // 4. Send reminders with delays to avoid ban (Staggered)
        let count = 0;
        for (const inv of invoices) {
            const rawNumber = inv.contact?.whatsapp || inv.contact?.phone;
            if (rawNumber) {
                const humanDelay = Math.floor(Math.random() * (50000 - 20000 + 1) + 20000); // 20-50s
                await sleep(humanDelay);

                let message = '';
                const customTemplate = comp.settings?.automation_overdue_template;

                if (customTemplate) {
                    message = customTemplate.replace('{name}', inv.contact.name.split(' ')[0]);
                } else {
                    message = overdueTemplates[Math.floor(Math.random() * overdueTemplates.length)];
                    message = message.replace('{name}', inv.contact.name.split(' ')[0])
                        .replace('{company}', comp.trade_name || 'nossa empresa');
                }

                message += " " + randomEmojis[Math.floor(Math.random() * randomEmojis.length)];

                const targetNumber = rawNumber.replace(/\D/g, '')
                if (targetNumber.length >= 10) {
                    await sendWhatsApp(instanceName, targetNumber, message)
                    count++;
                }
            }
        }

        return new Response(JSON.stringify({ success: true, sent: count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }
})
