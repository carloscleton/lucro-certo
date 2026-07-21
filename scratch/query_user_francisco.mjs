import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vfyhymrpxwshqrxqxgqm.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error("Missing anonymous key.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFrancisco() {
    // Search using ilike
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', '%laboratoriosaocamilo94%');

    if (error) {
        console.error("Error fetching profile:", error);
    } else {
        console.log("PROFILES FOUND (ilike):");
        console.log(JSON.stringify(profiles, null, 2));
    }
}

checkFrancisco();
