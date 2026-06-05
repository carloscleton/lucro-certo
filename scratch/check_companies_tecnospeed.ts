import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkCompanies() {
    const { data, error } = await supabase
        .from('companies')
        .select('id, cnpj, tecnospeed_config, fiscal_module_enabled');

    if (error) {
        console.error('Error fetching companies:', error);
        return;
    }

    console.log(`Found ${data?.length} companies:`);
    for (const comp of data || []) {
        console.log(`-----------------------------------------------`);
        console.log(`ID: ${comp.id}`);
        console.log(`CNPJ: ${comp.cnpj}`);
        console.log(`Fiscal Enabled: ${comp.fiscal_module_enabled}`);
        console.log(`TecnoSpeed Config:`, JSON.stringify(comp.tecnospeed_config, null, 2));
    }
}

checkCompanies();
