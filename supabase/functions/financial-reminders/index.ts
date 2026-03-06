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
    // Evolution v2 uses /message/sendText
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
        const { company_id, days = 7 } = await req.json()

        if (!company_id) {
            throw new Error('company_id is required')
        }

        // 1. Get Company and Social Profile (for whatsapp number)
        const { data: company } = await supabase.from('companies').select('trade_name').eq('id', company_id).single()
        const { data: profile } = await supabase.from('social_profiles').select('approval_whatsapp').eq('company_id', company_id).single()

        if (!profile?.approval_whatsapp) {
            return new Response(JSON.stringify({ error: 'Número de WhatsApp não configurado no Social Copilot.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 2. Get Pending/Late Transactions (Expense)
        const today = new Date().toISOString().split('T')[0]
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        const futureStr = futureDate.toISOString().split('T')[0]

        const { data: transactions, error: transError } = await supabase
            .from('transactions')
            .select('*, contact:contacts(name)')
            .eq('company_id', company_id)
            .eq('type', 'expense')
            .neq('status', 'paid')
            .lte('date', futureStr)
            .order('date', { ascending: true })

        if (transError) throw transError

        if (!transactions || transactions.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'Nenhum compromisso financeiro pendente encontrado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 3. Find a connected WhatsApp instance
        const { data: waInstances } = await supabase
            .from('instances')
            .select('instance_name')
            .eq('company_id', company_id)
            .eq('status', 'connected')
            .limit(1)

        const instanceName = waInstances?.[0]?.instance_name
        if (!instanceName) {
            return new Response(JSON.stringify({ error: 'Nenhuma instância de WhatsApp conectada encontrada.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 4. Format Message
        const overdue = transactions.filter(t => t.date < today)
        const upcoming = transactions.filter(t => t.date >= today)

        let message = `💰 *Resumo de Compromissos Financeiros*\n🏢 *${company?.trade_name || 'Empresa'}*\n\nOlá! Aqui está o resumo das suas contas a pagar para que você tenha o controle total do seu caixa:\n\n`

        if (overdue.length > 0) {
            message += `🔴 *VENCIDOS (Atrasados):*\n`
            overdue.forEach(t => {
                const dateStr = new Date(t.date).toLocaleDateString('pt-BR')
                message += `- ${t.description} (${t.contact?.name || 'Geral'}): *R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* - Venceu em ${dateStr}\n`
            })
            message += `\n`
        }

        if (upcoming.length > 0) {
            message += `🗓️ *PRÓXIMOS ${days} DIAS:*\n`
            upcoming.forEach(t => {
                const dateStr = new Date(t.date).toLocaleDateString('pt-BR')
                message += `- ${t.description} (${t.contact?.name || 'Geral'}): *R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* - Vence em ${dateStr}\n`
            })
            message += `\n`
        }

        const total = transactions.reduce((sum, t) => sum + t.amount, 0)
        message += `📊 *Total Pendente:* R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`
        message += `Acesse seu painel *Lucro Certo* para realizar os pagamentos e manter seu fluxo de caixa em dia! 🚀`

        // 5. Send WhatsApp
        const targetNumber = profile.approval_whatsapp.replace(/\D/g, '')
        const success = await sendWhatsApp(instanceName, targetNumber, message)

        return new Response(JSON.stringify({ success, message: success ? 'Resumo enviado com sucesso!' : 'Erro ao enviar mensagem via Evolution API.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
