import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin access

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const targetPhone = "84998071213";
    console.log(`Checking for phone: ${targetPhone}`);

    // 1. Search in companies by settings
    const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, trade_name, settings')
        .contains('settings', { automation_whatsapp_number: targetPhone });

    if (compErr) console.error("Error searching companies:", compErr);
    console.log("--- COMPANIES MATCHING SETTINGS PHONE ---");
    console.log(JSON.stringify(companies, null, 2));

    // 2. Search by company phone
    const { data: companies2, error: compErr2 } = await supabase
        .from('companies')
        .select('id, trade_name, settings, phone')
        .ilike('phone', `%${targetPhone}%`);
    
    console.log("--- COMPANIES MATCHING MAIN PHONE ---");
    console.log(JSON.stringify(companies2, null, 2));

    const allCompanies = [...(companies || []), ...(companies2 || [])];
    const uniqueCompanies = Array.from(new Set(allCompanies.map(c => c.id))).map(id => allCompanies.find(c => c.id === id));

    for (const comp of uniqueCompanies) {
        console.log(`\n=== INSPECTING COMPANY: ${comp.trade_name} (${comp.id}) ===`);
        
        // Check settings specifically
        console.log("Full Settings:", JSON.stringify(comp.settings, null, 2));

        // 3. Check instances for this company
        const { data: instances, error: instErr } = await supabase
            .from('instances')
            .select('*')
            .eq('company_id', comp.id);

        console.log("--- INSTANCES ---");
        console.log(JSON.stringify(instances, null, 2));
        
        // 4. Check transactions
        const { data: transactions, error: transErr } = await supabase
            .from('transactions')
            .select('id, description, date, amount, status, type')
            .eq('company_id', comp.id)
            .neq('status', 'paid')
            .neq('status', 'received')
            .order('date', { ascending: true });

        console.log("--- UNPAID TRANSACTIONS ---");
        console.log(JSON.stringify(transactions, null, 2));
    }
}

check();
