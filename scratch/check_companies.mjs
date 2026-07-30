import axios from 'axios';

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function check() {
    try {
        const compRes = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        const companies = compRes.data;
        for (const company of companies) {
            const str = JSON.stringify(company);
            if (str.includes('f0df81e0')) {
                console.log(`Found in company ${company.trade_name} (${company.id})`);
                console.log(JSON.stringify(company, null, 2));
            }
        }
        
        // Also check profiles or settings
        const profRes = await axios.get(`${SUPABASE_URL}/rest/v1/profiles`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        for (const prof of profRes.data) {
            const str = JSON.stringify(prof);
            if (str.includes('f0df81e0')) {
                console.log(`Found in profile ${prof.email} (${prof.id})`);
            }
        }
    } catch (err) {
        console.error('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

check();
