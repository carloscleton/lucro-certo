import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

async function getCompanyFiscalConfig(companyId: string) {
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!;
    const headers = { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` };
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
        params: { id: `eq.${companyId}`, select: 'id,tecnospeed_config,settings' },
        headers
    });
    return response.data?.[0];
}

const sanitizeKey = (val: any) => {
    if (!val) return '';
    let s = String(val).trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    if (s.includes('{') || s.includes(':')) {
        const match = s.match(/[a-f0-9-]{36}/i);
        if (match) s = match[0];
    }
    return s.trim();
};

async function test() {
    const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    const id = 'AVULSA_1783166447469_7676';
    
    try {
        const company = await getCompanyFiscalConfig(companyId);
        const config = company?.tecnospeed_config || {};
        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        
        console.log(`Getting invoice status for ${id} from PlugNotas...`);
        const response = await axios.get(`https://api.sandbox.plugnotas.com.br/nfse/nacional/${id}`, {
            headers: { 'x-api-key': apiKey }
        });
        
        console.log('STATUS RESULT:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err: any) {
        console.error('Error:', err.response?.status, err.message);
        if (err.response?.data) {
            console.error('Data:', err.response.data);
        }
    }
}

test();
