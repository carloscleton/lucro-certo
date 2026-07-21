import axios from 'axios';
import fs from 'fs';
import path from 'path';

const envPath = path.join('c:/Projeto-antigravity', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_ANON_KEY = env['VITE_SUPABASE_ANON_KEY'];

async function printConfig() {
    try {
        const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';
        const dbHeaders = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        };

        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            headers: dbHeaders
        });
        const company = response.data[0];
        console.log('Company settings:', JSON.stringify(company.settings, null, 2));
        console.log('Company tecnospeed_config:', JSON.stringify(company.tecnospeed_config, null, 2));
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

printConfig();
