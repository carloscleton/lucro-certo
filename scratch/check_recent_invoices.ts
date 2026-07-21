import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Load .env manually
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

async function checkRecentInvoices() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Supabase configuration missing in .env!');
        return;
    }

    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices?select=id,company_id,quote_id,external_id,type,status,pdf_url,created_at&order=created_at.desc&limit=5`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log('RECENT INVOICES IN DB:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (err: any) {
        console.error('Error fetching invoices:', err.response?.data || err.message);
    }
}

checkRecentInvoices();
