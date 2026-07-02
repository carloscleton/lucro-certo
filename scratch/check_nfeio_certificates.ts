import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data: companies, error } = await supabase.from('companies').select('id, trade_name, settings');
    if (error) {
        console.error('Error fetching companies:', error);
        return;
    }

    for (const comp of companies || []) {
        const nfeio = comp.settings?.nfeio_config;
        if (nfeio && nfeio.apiKey && nfeio.companyId) {
            console.log(`\n=== Company: ${comp.trade_name} ===`);
            console.log(`NFe.io config:`, JSON.stringify(nfeio, null, 2));

            const apiKey = nfeio.apiKey.trim();
            const companyIdNfe = nfeio.companyId.trim();

            try {
                // Fetch company details (v1)
                const v1Res = await axios.get(`https://api.nfe.io/v1/companies/${companyIdNfe}`, {
                    headers: { 'Authorization': apiKey }
                });
                console.log(`GET /v1/companies/${companyIdNfe} response:`, JSON.stringify(v1Res.data, null, 2));
            } catch (err: any) {
                console.error(`Error querying /v1/companies/${companyIdNfe}:`, err.response?.data || err.message);
            }

            try {
                // Fetch certificates (v2) if there is an endpoint for it?
                // Let's try to query the list of certificates or try to query the certificate we had
                console.log(`Checking certificates on v2...`);
                // Let's check if we can query v2/companies/{companyId}/certificates
                const v2Res = await axios.get(`https://api.nfse.io/v2/companies/${companyIdNfe}/certificates`, {
                    headers: { 'Authorization': apiKey }
                });
                console.log(`GET /v2/companies/${companyIdNfe}/certificates response:`, JSON.stringify(v2Res.data, null, 2));
            } catch (err: any) {
                console.error(`Error querying /v2/companies/${companyIdNfe}/certificates:`, err.response?.data || err.message);
            }
        }
    }
}

test();
