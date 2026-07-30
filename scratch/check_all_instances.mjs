import axios from 'axios';

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function check() {
    try {
        console.log('--- All Instances ---');
        const instRes = await axios.get(`${SUPABASE_URL}/rest/v1/instances?select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        console.log(instRes.data);
    } catch (err) {
        console.error('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

check();
