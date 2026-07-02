import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies?select=id,trade_name,tecnospeed_config`, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error(err.message);
    }
}
run();
