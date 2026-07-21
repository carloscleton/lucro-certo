const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('id, company_id, external_id, type, status, payload')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    console.log("Invoices:", JSON.stringify(invoices, null, 2));
}

run();
