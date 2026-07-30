import axios from 'axios';

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function check() {
    try {
        console.log('--- Connected Instances ---');
        const instRes = await axios.get(`${SUPABASE_URL}/rest/v1/instances?select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        console.log(instRes.data);

        console.log('\n--- Active Marketing Campaigns ---');
        const campRes = await axios.get(`${SUPABASE_URL}/rest/v1/marketing_campaigns?select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        console.log(campRes.data);

        console.log('\n--- App Settings (landing_banner / landing_plans) ---');
        const appRes = await axios.get(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        console.log(JSON.stringify(appRes.data, null, 2));

        console.log('\n--- Latest 5 Radar Leads ---');
        const leadRes = await axios.get(`${SUPABASE_URL}/rest/v1/radar_leads?order=created_at.desc&limit=5`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        console.log(leadRes.data);

    } catch (err) {
        console.error('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

check();
