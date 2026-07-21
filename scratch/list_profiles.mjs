import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAll() {
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, settings');

    if (error) {
        console.error("Error fetching profiles:", error);
    } else {
        console.log(`TOTAL PROFILES: ${profiles.length}`);
        console.log(JSON.stringify(profiles, null, 2));
    }
}

listAll();
