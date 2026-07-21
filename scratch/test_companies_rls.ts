import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

async function testQuery(authHeader: string | null) {
    const headers: any = {
        'apikey': SUPABASE_ANON_KEY
    };
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }
    
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.84d1586e-5d0c-456f-aa12-aefc5a9364a7&select=id,settings`, {
            headers
        });
        console.log(`Success with auth [${authHeader || 'none'}]:`, response.data.length, 'records found.');
        if (response.data.length > 0) {
            console.log('Sample:', response.data[0]);
        }
    } catch (err: any) {
        console.error(`Error with auth [${authHeader || 'none'}]:`, err.response?.status, err.message);
    }
}

async function test() {
    console.log('Testing companies table RLS...');
    await testQuery(null);
    await testQuery(`Bearer ${SUPABASE_ANON_KEY}`);
}

test();
