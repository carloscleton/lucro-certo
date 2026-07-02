import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
    try {
        console.log('--- DB Instances ---');
        const { data: dbInstances } = await supabase.from('instances').select('id, instance_name, evolution_instance_id, status');
        console.log(dbInstances);

        console.log('--- Evolution Instances ---');
        const evoRes = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        const evoInstances = Array.isArray(evoRes.data) ? evoRes.data : [];
        console.log(evoInstances.map((i: any) => ({
            id: i.id,
            name: i.name || i.instanceName,
            token: i.token,
            status: i.connectionStatus
        })));
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

main();
