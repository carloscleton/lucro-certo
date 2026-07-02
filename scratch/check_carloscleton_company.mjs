import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', '84d1586e-5d0c-456f-aa12-aefc5a9364a7')
        .single();

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("COMPANY ID:", company.id);
    console.log("CNPJ:", company.cnpj);
    console.log("TECNOSPEED CONFIG:", JSON.stringify(company.tecnospeed_config, null, 2));
    console.log("SETTINGS:", JSON.stringify(company.settings, null, 2));
}

main();
