import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function runBlogJobs(target_company_id?: string) {
    console.log('Blog Copilot: Starting run', target_company_id ? `for company ${target_company_id}` : 'for all companies')
    let processed = 0;
    const processedLogs: any[] = [];

    // 1. Fetch companies
    let query = supabase
        .from('companies')
        .select('id, trade_name')
        .eq('has_social_copilot', true);

    if (target_company_id) {
        query = query.eq('id', target_company_id);
    }

    const { data: companies, error: cmpError } = await query;

    if (cmpError) throw cmpError
    if (!companies || companies.length === 0) {
        return { message: 'Nenhuma empresa ativa para blog copilot.', processed, logs: processedLogs }
    }

    for (const company of companies) {
        // 2. Fetch Profile
        const { data: profile } = await supabase
            .from('social_profiles')
            .select('*')
            .eq('company_id', company.id)
            .single()

        if (!profile) continue;

        // 3. Check Autopilot if not manual
        if (!target_company_id) {
            if (!profile.blog_autopilot_enabled) continue;

            const today = new Date().getDay(); // 0-6
            const freq = profile.blog_autopilot_frequency || 'weekly';

            let shouldRunToday = false;
            if (freq === 'daily') shouldRunToday = true;
            else if (freq === 'thrice_weekly') shouldRunToday = [1, 3, 5].includes(today);
            else if (freq === 'weekly') shouldRunToday = (today === 1);

            if (!shouldRunToday) continue;
        }

        // 4. Generate Blog Post
        console.log(`Gerando artigo automático para ${company.trade_name}...`);
        try {
            // Usamos o nicho como tópico padrão se for automático
            const topic = `Tendências e Dicas de ${profile.niche} para 2026`;

            const { data, error } = await supabase.functions.invoke('social-blog-generator', {
                body: { company_id: company.id, topic: topic }
            });

            if (error) throw error;

            processedLogs.push({ company: company.trade_name, status: 'success', topic });
            processed++;
        } catch (err: any) {
            console.error(`Erro no blog cron para ${company.trade_name}:`, err);
            processedLogs.push({ company: company.trade_name, status: 'error', error: err.message });
        }
    }

    return { message: "Blog Job completed", processed, logs: processedLogs };
}

// Cron Trigger: Everyday at 10:00 AM UTC
if (typeof (Deno as any).cron === 'function') {
    (Deno as any).cron('Blog Copilot Daily Generation', '0 10 * * *', async () => {
        try {
            await runBlogJobs();
        } catch (err) {
            console.error("Blog Cron Engine Error:", err);
        }
    })
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const { company_id } = await req.json().catch(() => ({}));
        const result = await runBlogJobs(company_id);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 })
    } catch (err: any) {
        return new Response(String(err?.message), { headers: corsHeaders, status: 500 })
    }
})
