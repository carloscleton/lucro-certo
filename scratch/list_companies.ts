import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    console.log("Checking companies...");
    const { data: companies, error } = await supabase.from('companies').select('*');
    if (error) {
        console.error("Error fetching companies:", error);
    } else {
        console.log("Companies count:", companies?.length);
        console.log("Companies IDs & details:", JSON.stringify(companies?.map(c => ({
            id: c.id,
            razao_social: c.razao_social,
            nome_fantasia: c.nome_fantasia,
            cnpj: c.cnpj,
            fiscal_module_enabled: c.fiscal_module_enabled
        })), null, 2));
    }
}

main();
