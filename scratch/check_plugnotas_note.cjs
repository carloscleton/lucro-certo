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

async function checkNote() {
    try {
        const id = '668bbefdfdf0039f972b22bb'; // Use a dummy or real ID if we can find one. We will see the response code anyway.
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

        console.log(`Using API Key: ${apiKey.substring(0, 5)}...`);

        // 1. Get status under national
        try {
            const res = await axios.get(`${baseUrl}/nfse/nacional/${id}`, {
                headers: { 'x-api-key': apiKey }
            });
            console.log('✅ National Status Response:', res.status, res.data);
        } catch (err) {
            console.log('❌ National Status Error:', err.response?.status, err.response?.data || err.message);
        }

        // 2. Get status under municipal
        try {
            const res = await axios.get(`${baseUrl}/nfse/${id}`, {
                headers: { 'x-api-key': apiKey }
            });
            console.log('✅ Municipal Status Response:', res.status, res.data);
        } catch (err) {
            console.log('❌ Municipal Status Error:', err.response?.status, err.response?.data || err.message);
        }

        // 3. Try download municipal PDF
        try {
            const res = await axios.get(`${baseUrl}/nfse/pdf/${id}`, {
                headers: { 'x-api-key': apiKey },
                responseType: 'arraybuffer'
            });
            console.log('✅ Municipal PDF Download Success! Size:', res.data.byteLength);
        } catch (err) {
            console.log('❌ Municipal PDF Download Error:', err.response?.status, err.message);
        }

        // 4. Try download national PDF
        try {
            const res = await axios.get(`${baseUrl}/nfse/nacional/pdf/${id}`, {
                headers: { 'x-api-key': apiKey },
                responseType: 'arraybuffer'
            });
            console.log('✅ National PDF Download Success! Size:', res.data.byteLength);
        } catch (err) {
            console.log('❌ National PDF Download Error:', err.response?.status, err.message);
        }

    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkNote();
