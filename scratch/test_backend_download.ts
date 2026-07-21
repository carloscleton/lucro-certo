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

async function testBackendDownload() {
    try {
        // Fetch the last few invoices from the database to find a valid external_id
        const dbHeaders = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        };

        const response = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices?select=id,external_id,type,company_id,status&limit=5&order=created_at.desc`, {
            headers: dbHeaders
        });

        console.log('RECENT INVOICES IN DB:');
        console.log(response.data);

        if (response.data.length === 0) {
            console.log('No invoices found.');
            return;
        }

        const invoice = response.data[0];
        console.log(`\nTesting PDF download for invoice id: ${invoice.id}, external_id: ${invoice.external_id}, type: ${invoice.type}`);

        // Let's call the local backend server (assuming it is running on port 3001, or we can just run the logic directly)
        // Since we can query PlugNotas directly using the config, let's load the company config and test PlugNotas response
        const companyResponse = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${invoice.company_id}&select=tecnospeed_config`, {
            headers: dbHeaders
        });
        const config = companyResponse.data[0]?.tecnospeed_config || {};
        const apiKey = config.tecnospeed_api_key;
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const rawBase = isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase);
        const baseUrl = String(rawBase).toLowerCase().replace(/\/$/, '');

        console.log(`Base URL: ${baseUrl}`);
        console.log(`Is Nacional: ${config.nfse_nacional}`);

        const endpointsToTest = [
            `${baseUrl}/nfse/nacional/pdf/${invoice.external_id}`,
            `${baseUrl}/nfse/pdf/${invoice.external_id}`
        ];

        for (const url of endpointsToTest) {
            try {
                console.log(`\nGET ${url}...`);
                const res = await axios.get(url, {
                    headers: { 'x-api-key': apiKey },
                    responseType: 'arraybuffer'
                });
                console.log(`✅ SUCCESS! Size: ${res.data.byteLength} bytes`);
            } catch (err: any) {
                console.log(`❌ FAILED: Status ${err.response?.status} | Message: ${err.message}`);
                if (err.response?.data) {
                    try {
                        const jsonStr = Buffer.from(err.response.data).toString('utf8');
                        console.log(`   Response body: ${jsonStr}`);
                    } catch (parseErr) {
                        console.log('   (Could not parse response body as text)');
                    }
                }
            }
        }

    } catch (err: any) {
        console.error('Error during test:', err.response?.data || err.message);
    }
}

testBackendDownload();
