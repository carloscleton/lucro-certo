import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching all companies...");
    const { data: companies, error } = await supabase
        .from('companies')
        .select('id, legal_name, trade_name, cnpj, tecnospeed_config, settings, fiscal_module_enabled');

    if (error) {
        console.error("Error:", error);
        return;
    }

    companies.forEach(c => {
        console.log(`\n========================================`);
        console.log(`ID: ${c.id}`);
        console.log(`Name: ${c.legal_name} (${c.trade_name})`);
        console.log(`CNPJ: ${c.cnpj}`);
        console.log(`Enabled: ${c.fiscal_module_enabled}`);
        console.log(`TecnoSpeed Config:`, JSON.stringify(c.tecnospeed_config, null, 2));
        console.log(`Settings:`, JSON.stringify(c.settings, null, 2));
    });
}

main();
