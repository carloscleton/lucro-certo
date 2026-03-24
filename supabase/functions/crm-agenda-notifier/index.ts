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
        // Support for direct message override (invoked by other functions)
        const body = await req.json().catch(() => ({}));
        if (body.overrideMessage && body.targetPhone) {
            // Find a connected instance for this company
            const { data: waInstances } = await supabase.from('instances').select('instance_name').eq('company_id', body.companyId).eq('status', 'connected').limit(1);
            const instanceName = waInstances?.[0]?.instance_name || 'LucroCerto';
            
            const targetNumber = body.targetPhone.replace(/\D/g, '');
            const success = await sendWhatsApp(instanceName, targetNumber, body.overrideMessage);
            
            return new Response(JSON.stringify({ success }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Obter todas as tarefas pendentes que vencem nos próximos 45 minutos (e as já vencidas há pouco tempo que não foram avisadas)
        const now = new Date();
        const futureLimit = new Date(now.getTime() + 45 * 60000); // 45 minutes ahead
        const pastLimit = new Date(now.getTime() - 24 * 60 * 60000); // 1 day ago max, to avoid bombing

        // Buscar tarefas que não tem a flag de notificação e que estão no escopo de tempo
        const { data: tasks, error: tasksError } = await supabase
            .from('crm_tasks')
            .select(`
                *,
                company:companies(trade_name, phone, settings),
                lead:radar_leads(name),
                deal:crm_deals(title),
                contact:contacts(name, whatsapp, phone)
            `)
            .eq('status', 'pending')
            .gte('due_date', pastLimit.toISOString())
            .lte('due_date', futureLimit.toISOString());

        if (tasksError) throw tasksError;

        if (!tasks || tasks.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'Nenhuma tarefa para notificar agora.', count: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        let sentCount = 0;

        for (const task of tasks) {
            // Verificar no JSONB meta se a notificação já foi enviada
            const meta = task.meta || {};
            if (meta.reminder_sent) {
                continue; // já foi
            }

            // Descobrir pra quem mandar a notificação (Número do usuário ou da empresa)
            let rawNumber: string | null = null;
            let targetName = 'Equipe';

            // 1. Tentar pegar o número do responsável
            if (task.assigned_to) {
                const { data: userSettings } = await supabase.from('user_settings').select('automation_whatsapp_number').eq('user_id', task.assigned_to).single();
                if (userSettings?.automation_whatsapp_number) rawNumber = userSettings.automation_whatsapp_number;
                
                // Fetch profile name if needed
                const { data: profile } = await supabase.from('social_profiles').select('name').eq('id', task.assigned_to).single();
                if (profile?.name) targetName = profile.name;
            }

            // 2. Fallback para o número da empresa
            if (!rawNumber && task.company) {
                const companyData: any = Array.isArray(task.company) ? task.company[0] : task.company;
                rawNumber = companyData?.settings?.automation_whatsapp_number || companyData?.phone;
            }

            if (!rawNumber) continue;

            const targetNumber = rawNumber.replace(/\D/g, '');

            // Pegar a instância conectada da empresa
            const { data: waInstances } = await supabase.from('instances').select('instance_name').eq('company_id', task.company_id).eq('status', 'connected').limit(1);
            const instanceName = waInstances?.[0]?.instance_name || 'LucroCerto';

            // Montar a mensagem
            const taskTime = new Date(task.due_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            let relatedText = '';
            const leadData = Array.isArray(task.lead) ? task.lead[0] : task.lead;
            const dealData = Array.isArray(task.deal) ? task.deal[0] : task.deal;
            const contactData = Array.isArray(task.contact) ? task.contact[0] : task.contact;

            if (leadData) relatedText += `\n👤 *Lead:* ${leadData.name}`;
            if (contactData) relatedText += `\n👤 *Contato:* ${contactData.name} ${contactData.whatsapp ? `(${contactData.whatsapp})` : ''}`;
            if (dealData) relatedText += `\n💼 *Negócio:* ${dealData.title}`;

            const taskTypeIcons: Record<string, string> = {
                call: '📞 Ligação',
                meeting: '🎥 Reunião',
                email: '📧 E-mail',
                payment: '💳 Cobrança / Pagamento',
                todo: '✅ Tarefa'
            };
            const typeText = taskTypeIcons[task.task_type] || '✅ Tarefa';

            const message = `⚠️ *Lembrete de Compromisso* ⚠️\nOlá ${targetName}, você tem uma tarefa agendada em breve!\n\n📌 *${task.title}*\n🕒 *Horário:* ${taskTime}\n🧩 *Tipo:* ${typeText}${relatedText}\n\n👉 Acesse o Lucro Certo para ver mais detalhes!`;

            // Enviar WhatsApp
            const success = await sendWhatsApp(instanceName, targetNumber, message);
            
            if (success) {
                // Atualizar flag no banco
                const updatedMeta = { ...meta, reminder_sent: true, reminder_sent_at: new Date().toISOString() };
                await supabase.from('crm_tasks').update({ meta: updatedMeta }).eq('id', task.id);
                sentCount++;
                
                // Pequeno delay para evitar bloqueios de API
                await sleep(1500);
            }
        }

        return new Response(JSON.stringify({ success: true, count: sentCount, message: `${sentCount} lembretes disparados.` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
})
