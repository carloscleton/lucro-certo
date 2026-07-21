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

async function checkAllInvoices() {
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices?select=id,company_id,external_id,type,status`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log('ALL INVOICES IN DB:', response.data);
    } catch (err) {
        console.error('Error fetching invoices:', err.response?.data || err.message);
    }
}

checkAllInvoices();
