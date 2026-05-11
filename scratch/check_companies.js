import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function check() {
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies?select=id,legal_name,cnpj,tecnospeed_config`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error(err.message);
    }
}

check();
