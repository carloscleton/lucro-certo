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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { company_id, days = 7, is_manual = false } = await req.json()

        if (!company_id) {
            throw new Error('company_id is required')
        }

        if (!is_manual) {
            // Delay randômico para evitar disparos em massa simultâneos apenas no automático
            const bootDelay = Math.floor(Math.random() * (30000 - 1000 + 1) + 1000);
            await sleep(bootDelay);
        }

        const { data: company } = await supabase.from('companies').select('trade_name, phone, settings').eq('id', company_id).single()
        const { data: profile } = await supabase.from('social_profiles').select('approval_whatsapp').eq('company_id', company_id).single()

        // Hierarquia de número para envio:
        // 1. Configuração específica de automação
        // 2. Telefone da empresa
        // 3. Telefone do Social Copilot (fallback legado)
        const rawNumber = (company?.settings as any)?.automation_whatsapp_number || company?.phone || profile?.approval_whatsapp

        if (!rawNumber) {
            return new Response(JSON.stringify({ error: 'Nenhum número de WhatsApp configurado para receber notificações. Configure o WhatsApp da Empresa ou o número nas Automações.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const today = new Date().toISOString().split('T')[0]
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        const futureStr = futureDate.toISOString().split('T')[0]

        const { data: transactions, error: transError } = await supabase
            .from('transactions')
            .select('*, contact:contacts(name)')
            .eq('company_id', company_id)
            .neq('status', 'paid')
            .neq('status', 'received')
            .lte('date', futureStr)
            .order('date', { ascending: true })

        if (transError) throw transError

        if (!transactions || transactions.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'Nenhum compromisso financeiro pendente encontrado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        const { data: waInstances } = await supabase.from('instances').select('instance_name').eq('company_id', company_id).eq('status', 'connected').limit(1)
        const instanceName = waInstances?.[0]?.instance_name || 'LucroCerto'

        const payables = transactions.filter(t => t.type === 'expense')
        const receivables = transactions.filter(t => t.type === 'income')

        const totalPay = payables.reduce((s, t) => s + t.amount, 0)
        const totalRec = receivables.reduce((s, t) => s + t.amount, 0)
        const balance = (totalRec - totalPay).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        const summaryText = `💰 *Resumo Financeiro*\n\n` +
            (payables.length > 0 ? `💸 *A PAGAR:* R$ ${totalPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` : '') +
            (receivables.length > 0 ? `📈 *A RECEBER:* R$ ${totalRec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` : '') +
            `📊 *SALDO:* R$ ${balance}`;

        // Get company settings for custom template
        const { data: compSettings } = await supabase.from('companies').select('settings').eq('id', company_id).single();
        const customTemplate = compSettings?.settings?.automation_financial_template;

        let message: string; // Declare message here

        if (customTemplate) {
            message = customTemplate
                .replace('{summary}', summaryText)
                .replace('{trade_name}', company?.trade_name || '')
                .replace('{balance}', balance);
        } else {
            message = `💰 *Resumo Financeiro Lucro Certo*\n🏢 *${company?.trade_name || 'Sua Empresa'}*\n\n`;
            if (payables.length > 0) {
                const overdue = payables.filter(t => t.date < today)
                const upcoming = payables.filter(t => t.date >= today)
                message += `💸 *CONTAS A PAGAR:*\n`
                if (overdue.length > 0) message += `🔴 *Vencidas:* R$ ${overdue.reduce((s, t) => s + t.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
                if (upcoming.length > 0) message += `🗓️ *Próximos ${days} dias:* R$ ${upcoming.reduce((s, t) => s + t.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
                message += `\n`
            }
            if (receivables.length > 0) {
                const overdue = receivables.filter(t => t.date < today)
                const upcoming = receivables.filter(t => t.date >= today)
                message += `📈 *CONTAS A RECEBER:*\n`
                if (overdue.length > 0) message += `🔴 *Em atraso:* R$ ${overdue.reduce((s, t) => s + t.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
                if (upcoming.length > 0) message += `🗓️ *A receber (${days} dias):* R$ ${upcoming.reduce((s, t) => s + t.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`
                message += `\n`
            }
            message += `📊 *SALDO PREVISTO:* R$ ${balance}\n\n`;
            message += `Acesse seu painel para ver os detalhes: lucrocerto.idealzap.com.br 🚀`;
        }

        const targetNumber = rawNumber.replace(/\D/g, '')
        const success = await sendWhatsApp(instanceName, targetNumber, message)

        return new Response(JSON.stringify({ success, message: success ? 'Resumo financeiro enviado!' : 'Erro Evolution API.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
