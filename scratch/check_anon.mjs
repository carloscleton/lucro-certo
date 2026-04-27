import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Searching for companies...");
    const { data: companies, error } = await supabase.from('companies').select('id, trade_name, phone');
    if (error) console.error("Error reading companies:", error);
    else console.log("Companies found:", JSON.stringify(companies, null, 2));

    console.log("Searching for instances...");
    const { data: instances, error: error2 } = await supabase.from('instances').select('id, instance_name, status, company_id');
    if (error2) console.error("Error reading instances:", error2);
    else console.log("Instances found:", JSON.stringify(instances, null, 2));
}

check();
