import axios from 'axios';

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function checkCompanies() {
    try {
        console.log('Fetching all companies...');
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
            params: {
                select: 'id,trade_name,cnpj,settings,status'
            },
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const companies = response.data || [];
        console.log(`Found ${companies.length} companies:`);
        for (const company of companies) {
            console.log(`- Name: "${company.trade_name}" | CNPJ: ${company.cnpj} | Status: ${company.status} | Settings:`, JSON.stringify(company.settings));
        }
    } catch (error) {
        console.error('Error fetching companies:', error.response?.data || error.message);
    }
}

checkCompanies();
