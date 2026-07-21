import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function test() {
    console.log(`Querying all instances in Supabase...`);
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/instances`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log('All instances:', JSON.stringify(response.data, null, 2));
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

test();
