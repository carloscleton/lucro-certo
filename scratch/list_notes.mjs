import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    console.log("Listing recent invoices...");
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (error) {
        console.error("Error querying db:", error);
    } else {
        console.log("Invoices:", JSON.stringify(invoices.map(i => ({
            id: i.id,
            external_id: i.external_id,
            type: i.type,
            cliente: i.cliente || i.payload?.destinatario?.razaoSocial || i.payload?.tomador?.razaoSocial,
            created_at: i.created_at
        })), null, 2));
    }
}

main();
