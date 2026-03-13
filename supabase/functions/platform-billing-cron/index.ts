import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

async function sendWhatsApp(instanceName: string, targetNumber: string, text: string) {
    try {
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
    } catch (e) {
        console.error('Error sending WhatsApp:', e)
        return false
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runBillingCycle() {
    console.log('Billing Cron: Starting run');
    try {
        // 1. Fetch App Settings
        const { data: settings, error: settingsError } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single()

        if (settingsError || !settings) {
            console.error('Could not fetch app settings:', settingsError);
            return;
        }

        if (!settings.billing_notifications_enabled) {
            console.log('Billing notifications are disabled');
            return;
        }

        const reminderDays = settings.billing_days_before_reminder || [5, 2, 0];
        const waInstance = settings.platform_whatsapp_instance || 'MainAdmin';
        const waTemplate = settings.billing_whatsapp_template || 'Olá, {company_name}! Sua mensalidade do Lucro Certo vence em {days} dias ({due_date}). Evite o bloqueio do sistema clicando no boleto/pix: {payment_link}';

        // 2. Fetch Companies to potentially notify
        const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('*')
            .neq('status', 'blocked');

        if (companiesError) throw companiesError;

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        for (const company of companies) {
            // Delay to avoid spamming
            await sleep(1000);

            const targetDate = company.subscription_plan === 'trial'
                ? (company.trial_ends_at ? new Date(company.trial_ends_at) : null)
                : (company.current_period_end ? new Date(company.current_period_end) : null);

            if (!targetDate || isNaN(targetDate.getTime())) continue;

            // Calculate diff in days
            const targetStr = targetDate.toISOString().split('T')[0];
            const diffTime = new Date(targetStr).getTime() - new Date(todayStr).getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            console.log(`Company: ${company.trade_name}, Status: ${company.subscription_status}, Days to expiry: ${diffDays}`);

            if (reminderDays.includes(diffDays)) {
                // Populate template
                const formattedDate = targetDate.toLocaleDateString('pt-BR');
                const value = (company.next_billing_value || 97).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const paymentLink = 'https://fatura.lucrocerto.com.br'; // Mock link for now

                const message = waTemplate
                    .replace(/{company_name}/g, company.trade_name || 'Empresa')
                    .replace(/{due_date}/g, formattedDate)
                    .replace(/{days}/g, diffDays.toString())
                    .replace(/{value}/g, value.toString())
                    .replace(/{payment_link}/g, paymentLink);

                // Find owner phone
                const { data: owner } = await supabase
                    .from('company_members')
                    .select('profiles(phone)')
                    .eq('company_id', company.id)
                    .eq('role', 'owner')
                    .maybeSingle();

                const targetNumber = (owner?.profiles as any)?.phone || company.phone;

                if (targetNumber) {
                    const cleanPhone = targetNumber.replace(/\D/g, '');
                    const success = await sendWhatsApp(waInstance, cleanPhone, message);
                    console.log(`Notification for ${company.trade_name}: ${success ? 'Sent' : 'Failed'}`);
                }
            }

            // 3. Auto-update status to past_due if expired
            if (diffDays < 0 && company.subscription_status === 'active') {
                await supabase
                    .from('companies')
                    .update({ subscription_status: 'past_due' })
                    .eq('id', company.id);
                console.log(`Company ${company.trade_name} marked as PAST_DUE`);
            }
        }
    } catch (err) {
        console.error('Error in Billing Cycle:', err);
    }
}

// CRON Trigger (Every day at 10:00 AM UTC / 07:00 AM BRT)
if (typeof (Deno as any).cron === 'function') {
    (Deno as any).cron('Platform Billing Reminders', '0 10 * * *', async () => {
        await runBillingCycle();
    })
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Allow manual trigger via POST
        await runBillingCycle();
        return new Response(JSON.stringify({ success: true, message: 'Billing cycle executed successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
})
