import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching profiles...");
    const { data: profiles, error: err1 } = await supabase
        .from('profiles')
        .select('*');
    if (err1) console.error("Profiles error:", err1);
    else console.log("Profiles:", profiles);

    console.log("Fetching company members...");
    const { data: members, error: err2 } = await supabase
        .from('company_members')
        .select('*');
    if (err2) console.error("Members error:", err2);
    else console.log("Company Members:", members);
}

main();
