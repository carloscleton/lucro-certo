import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import "https://deno.land/std@0.168.0/dotenv/load.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const targetPhone = "84998071213";
    console.log(`Checking for phone: ${targetPhone}`);

    // 1. Search in companies
    const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, trade_name, settings')
        .contains('settings', { automation_whatsapp_number: targetPhone });

    if (compErr) console.error("Error searching companies:", compErr);
    console.log("--- COMPANIES MATCHING SETTINGS PHONE ---");
    console.log(JSON.stringify(companies, null, 2));

    // 2. If not found in settings, search by company phone
    if (!companies || companies.length === 0) {
        const { data: companies2, error: compErr2 } = await supabase
            .from('companies')
            .select('id, trade_name, settings, phone')
            .ilike('phone', `%${targetPhone}%`);
        
        console.log("--- COMPANIES MATCHING MAIN PHONE ---");
        console.log(JSON.stringify(companies2, null, 2));
    }

    const companyId = companies?.[0]?.id || companies?.[1]?.id; // Just take the first one found

    if (companyId) {
        // 3. Check instances for this company
        const { data: instances, error: instErr } = await supabase
            .from('instances')
            .select('*')
            .eq('company_id', companyId);

        console.log("--- INSTANCES FOR COMPANY ---");
        console.log(JSON.stringify(instances, null, 2));
        
        // 4. Check transactions overdue
        const { data: transactions, error: transErr } = await supabase
            .from('transactions')
            .select('id, description, date, amount, status, type')
            .eq('company_id', companyId)
            .neq('status', 'paid')
            .neq('status', 'received')
            .order('date', { ascending: true });

        console.log("--- UNPAID TRANSACTIONS ---");
        console.log(JSON.stringify(transactions, null, 2));
    }
}

check();
