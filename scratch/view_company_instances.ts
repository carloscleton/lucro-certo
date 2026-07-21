import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
    const { data: instances, error } = await supabase
        .from('instances')
        .select('*')
        .eq('company_id', 'c784f24f-92e7-4ff6-9951-d7327fb77028');
    
    if (error) {
        console.error("Error:", error);
        return;
    }
    
    console.log("Instances for RJ DECOR:", JSON.stringify(instances, null, 2));
}

run();
