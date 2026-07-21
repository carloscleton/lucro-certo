import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

async function getCompanyFiscalConfig(authHeader: string | null, companyId: string) {
    const supabaseKey = SUPABASE_ANON_KEY;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);
    const column = isUUID ? 'id' : 'cnpj';
    const cleanId = isUUID ? companyId : companyId.replace(/\D/g, '');

    const headers: any = {
        'apikey': supabaseKey
    };
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }

    const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
        params: {
            [column]: `eq.${cleanId}`,
            select: 'id,tecnospeed_config,fiscal_module_enabled,settings'
        },
        headers
    });
    return response.data?.[0];
}

async function test() {
    const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    
    // We need a valid user session token to test. 
    // Since we don't have one in a static file, let's verify if getCompanyFiscalConfig throws an error when authHeader is null.
    try {
        console.log('Testing with null authHeader (representing Evolution API calling without token)...');
        const company = await getCompanyFiscalConfig(null, companyId);
        console.log('Result with null:', company ? 'Found company!' : 'Empty result (RLS blocked)');
    } catch (err: any) {
        console.error('Error with null:', err.message);
    }
}

test();
