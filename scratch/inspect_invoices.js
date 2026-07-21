import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: invoices, error } = await supabase
        .from('fiscal_invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error(error);
    } else {
        console.log("Last 5 Invoices:", JSON.stringify(invoices, null, 2));
    }
}

main();
