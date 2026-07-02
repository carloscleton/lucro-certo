import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Listing last 10 NFe.io invoices...");
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('id, created_at, external_id, type, status, invoice_number, pdf_url, company_id, payload')
        .eq('type', 'nfeio')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching invoices:", error);
        return;
    }

    console.log("Recent NFe.io Invoices:");
    invoices.forEach(inv => {
        console.log(`- ID: ${inv.id} | Date: ${inv.created_at} | ExtID: ${inv.external_id} | Status: ${inv.status} | Number: ${inv.invoice_number}`);
        console.log(`  PDF URL: ${inv.pdf_url}`);
        console.log(`  Retorno:`, JSON.stringify(inv.payload?.retorno || {}, null, 2));
    });
}

main();
