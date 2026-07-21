import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, anonKey)

async function main() {
    console.log("Fetching app_settings...");
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    console.log("Data:", data);
    console.log("Error:", error);
}

main();
