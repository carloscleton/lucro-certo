const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envPath = path.join('c:/Projeto-antigravity', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_ANON_KEY = env['VITE_SUPABASE_ANON_KEY'];

async function printNoteDetails() {
    try {
        const id = '6a4f8ceb44adc7e26565dc5f';
        const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';

        const dbHeaders = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        };

        const companyResponse = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}&select=tecnospeed_config`, {
            headers: dbHeaders
        });
        const config = companyResponse.data[0]?.tecnospeed_config || {};
        const apiKey = config.tecnospeed_api_key;
        const baseUrl = 'https://api.sandbox.plugnotas.com.br';

        const res = await axios.get(`${baseUrl}/nfse/${id}`, {
            headers: { 'x-api-key': apiKey }
        });
        console.log('NOTE DETAILS FROM PLUGNOTAS:');
        console.log(JSON.stringify(res.data, null, 2));

    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

printNoteDetails();
