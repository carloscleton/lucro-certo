import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    console.log("Checking company 84d1586e-5d8c-456f-aa12-aefc5a9364a7...");
    const { data: company, error } = await supabase
        .from('companies')
        .select('id, tecnospeed_config')
        .eq('id', '84d1586e-5d8c-456f-aa12-aefc5a9364a7')
        .maybeSingle();
        
    if (error) {
        console.error("Error querying db:", error);
    } else {
        console.log("Company found:", JSON.stringify(company, null, 2));
    }
}

main();
