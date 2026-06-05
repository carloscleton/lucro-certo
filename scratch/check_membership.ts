import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    console.log("Fetching session info...");
    // Let's list all companies from supabase to see what we get with the anon key
    const { data: companies, error: compErr } = await supabase.from('companies').select('id, trade_name, user_id');
    console.log("Companies visible with anon key:", companies, compErr);

    const { data: members, error: memErr } = await supabase.from('company_members').select('*');
    console.log("Members visible with anon key:", members, memErr);
}

main();
