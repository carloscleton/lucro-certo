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

async function testPdfEndpoints() {
    try {
        const id = '668bbefdfdf0039f972b22bb';
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

        try {
            console.log('Testing: GET /nfse/nacional/pdf/{id}');
            await axios.get(`${baseUrl}/nfse/nacional/pdf/${id}`, {
                headers: { 'x-api-key': apiKey }
            });
        } catch (err) {
            console.log('GET /nfse/nacional/pdf/{id} response body:', err.response?.status, err.response?.data);
        }

        try {
            console.log('Testing: GET /nfse/pdf/{id}');
            await axios.get(`${baseUrl}/nfse/pdf/${id}`, {
                headers: { 'x-api-key': apiKey }
            });
        } catch (err) {
            console.log('GET /nfse/pdf/{id} response body:', err.response?.status, err.response?.data);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

testPdfEndpoints();
