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

async function getAsaasPaymentLink(company: any, settings: any, amount: number) {
    const provider = settings.platform_billing_provider;
    if (provider !== 'asaas') return null;

    const isSandbox = settings.platform_billing_sandbox !== false;
    const env = isSandbox ? 'sandbox' : 'production';
    const config = settings.platform_billing_config?.asaas?.[env] || {};
    const apiKey = config.api_key;
    
    if (!apiKey) return null;
    const baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';

    try {
        // Find or Create Customer
        const cpfCnpj = (company.cnpj || company.document || '00000000000').replace(/\D/g, '');
        let customerId = '';

        const searchRes = await fetch(`${baseUrl}/customers?cpfCnpj=${cpfCnpj}`, {
            headers: { 'access_token': apiKey }
        });
        const searchData = await searchRes.json();

        if (searchData.data && searchData.data.length > 0) {
            customerId = searchData.data[0].id;
        } else {
            const createRes = await fetch(`${baseUrl}/customers`, {
                method: 'POST',
                headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: company.trade_name || 'Lucro Certo Customer',
                    cpfCnpj: cpfCnpj,
                    email: company.owner_email || '',
                    mobilePhone: company.phone || ''
                })
            });
            const createData = await createRes.json();
            if (createData.id) customerId = createData.id;
        }

        if (!customerId) return null;

        // Create/Get Charge
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);

        const chargeRes = await fetch(`${baseUrl}/payments`, {
            method: 'POST',
            headers: { 'access_token': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer: customerId,
                billingType: 'UNDEFINED',
                value: amount,
                dueDate: dueDate.toISOString().split('T')[0],
                description: `Mensalidade Lucro Certo - ${company.trade_name}`,
                externalReference: company.id
            })
        });
        const chargeData = await chargeRes.json();
        return chargeData.invoiceUrl || null;
    } catch (e) {
        console.error('Error generating Asaas link:', e);
        return null;
    }
}

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

        // Reminders: 5, 2, 0 days before, and 3 days after (overdue)
        const reminderDays = settings.billing_days_before_reminder || [5, 2, 0, -3, -7];
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
            await sleep(800); // Throttling

            if (company.settings?.billing_exempt) {
                console.log(`Skipping billing for exempt company: ${company.trade_name}`);
                continue;
            }

            const targetDate = company.subscription_plan === 'trial'
                ? (company.trial_ends_at ? new Date(company.trial_ends_at) : null)
                : (company.current_period_end ? new Date(company.current_period_end) : null);

            if (!targetDate || isNaN(targetDate.getTime())) continue;

            const targetStr = targetDate.toISOString().split('T')[0];
            const diffTime = new Date(targetStr).getTime() - new Date(todayStr).getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            console.log(`Company: ${company.trade_name}, Status: ${company.subscription_status}, Days: ${diffDays}`);

            if (reminderDays.includes(diffDays)) {
                const formattedDate = targetDate.toLocaleDateString('pt-BR');
                const amount = Number(company.next_billing_value) || 97;
                
                // Try to get real payment link
                let paymentLink = await getAsaasPaymentLink(company, settings, amount);
                if (!paymentLink) {
                    paymentLink = `https://lucrocerto.site/dashboard`; // Fallback to login
                }

                let message = waTemplate
                    .replace(/{company_name}/g, company.trade_name || 'Empresa')
                    .replace(/{due_date}/g, formattedDate)
                    .replace(/{days}/g, Math.abs(diffDays).toString())
                    .replace(/{value}/g, amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
                    .replace(/{payment_link}/g, paymentLink);

                // Adjustment for overdue message if generic
                if (diffDays < 0 && message.includes('vence em')) {
                    message = message.replace(/vence em .*/, `está atrasada há ${Math.abs(diffDays)} dias. Regularize agora para evitar bloqueio: ${paymentLink}`);
                }

                // Get owner phone
                const { data: owner } = await supabase
                    .from('company_members')
                    .select('profiles(phone)')
                    .eq('company_id', company.id)
                    .eq('role', 'owner')
                    .maybeSingle();

                const targetNumber = (owner?.profiles as any)?.phone || company.phone;

                if (targetNumber) {
                    let cleanPhone = targetNumber.replace(/\D/g, '');
                    
                    // Prepend 55 if standard BR number without country code
                    if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith('55')) {
                        cleanPhone = '55' + cleanPhone;
                    }

                    if (cleanPhone.length >= 10) {
                        const success = await sendWhatsApp(waInstance, cleanPhone, message);
                        console.log(`Notification for ${company.trade_name} (${diffDays}d): ${success ? 'Sent' : 'Failed'}`);
                    }
                }
            }

            // Auto-update status to past_due if expired
            if (diffDays < 0 && company.subscription_status === 'active') {
                await supabase
                    .from('companies')
                    .update({ subscription_status: 'past_due' })
                    .eq('id', company.id);
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
