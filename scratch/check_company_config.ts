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

async function checkCompanyConfig() {
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies?select=id,trade_name,tecnospeed_config`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log('COMPANIES IN DB:');
        response.data.forEach((c: any) => {
            console.log(`- ID: ${c.id}`);
            console.log(`  Trade Name: ${c.trade_name}`);
            console.log(`  Regime: ${c.tecnospeed_config?.regime_tributario}`);
            console.log(`  Nacional: ${c.tecnospeed_config?.nfse_nacional}`);
            console.log(`  Ambiente: ${c.tecnospeed_config?.ambiente}`);
            console.log(`  UseTestData: ${c.tecnospeed_config?.use_test_data}`);
            console.log(`  Default CNAE: ${c.tecnospeed_config?.default_cnae}`);
        });
    } catch (err: any) {
        console.error('Error:', err.response?.data || err.message);
    }
}

checkCompanyConfig();
