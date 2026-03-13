import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    console.log("Checking app_settings...");
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    if (error) {
        console.error("Error fetching settings:", error);
    } else {
        console.log("Settings found:", data);
        if (data) {
            console.log("Available keys:", Object.keys(data));
        }
    }
}

main();
