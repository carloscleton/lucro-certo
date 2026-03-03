import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
    console.log("Checking cron jobs...");
    const { data: posts, error } = await supabase.from('cron.job').select('*');
    console.log("Cron jobs:", posts, "Error:", error);
}

main();
