import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Listing last 10 invoices...");
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('id, created_at, external_id, type, status, invoice_number, pdf_url, company_id')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching invoices:", error);
        return;
    }

    console.log("Recent Invoices:");
    invoices.forEach(inv => {
        console.log(`- ID: ${inv.id} | Date: ${inv.created_at} | ExtID: ${inv.external_id} | Type: ${inv.type} | Status: ${inv.status} | Number: ${inv.invoice_number} | Company: ${inv.company_id}`);
        console.log(`  PDF: ${inv.pdf_url}`);
    });
}

main();
