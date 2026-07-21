import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function test() {
    const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    console.log(`Querying instances for company ${companyId} in Supabase...`);
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/instances?company_id=eq.${companyId}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log('Instances found in Supabase:', JSON.stringify(response.data, null, 2));
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

test();
