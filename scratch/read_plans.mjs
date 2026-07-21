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

async function checkPlans() {
    const { data, error } = await supabase
        .from('app_settings')
        .select('landing_plans')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        console.error("Error fetching app_settings:", error);
    } else {
        console.log("LANDING PLANS:");
        console.log(JSON.stringify(data?.landing_plans, null, 2));
    }
}

checkPlans();
