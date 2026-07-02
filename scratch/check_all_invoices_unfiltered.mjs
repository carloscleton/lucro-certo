import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function checkAllFiscalInvoices() {
    try {
        console.log('Fetching all fiscal invoices...');
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
            params: {
                select: '*'
            },
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const invoices = response.data || [];
        console.log(`Found ${invoices.length} invoices in database:`);
        for (const inv of invoices) {
            console.log(JSON.stringify(inv, null, 2));
        }
    } catch (error) {
        console.error('Error fetching invoices:', error.response?.data || error.message);
    }
}

checkAllFiscalInvoices();
