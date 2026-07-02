import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    try {
        console.log('--- DB Instances ---');
        const { data: dbInstances, error } = await supabase
            .from('instances')
            .select('id, instance_name, evolution_instance_id, company_id, status');
        if (error) throw error;
        console.log(dbInstances);

        console.log('--- Companies Settings ---');
        const { data: companies, error2 } = await supabase
            .from('companies')
            .select('id, trade_name, settings');
        if (error2) throw error2;
        console.log(companies.map(c => ({
            id: c.id,
            trade_name: c.trade_name,
            whatsapp_provider: c.settings?.whatsapp_provider
        })));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

main();
