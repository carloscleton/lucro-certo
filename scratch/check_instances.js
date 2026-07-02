import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, anonKey);

async function main() {
    console.log("Checking instances...");
    const { data: instances, error } = await supabase.from('instances').select('id, instance_name, phone_number, status');
    if (error) {
        console.error("Error fetching instances:", error);
    } else {
        console.log("Instances count:", instances?.length);
        console.log("Instances list:", JSON.stringify(instances, null, 2));
    }
}

main();
