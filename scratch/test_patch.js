import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function testPatch() {
    try {
        const companyId = "84d1586e-5d0c-456f-aa12-aefc5a9364a7";
        console.log(`🔍 Fetching current company...`);
        const getRes = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const company = getRes.data[0];
        const currentSettings = company.settings || {};
        
        const newSettings = {
            ...currentSettings,
            nfeio_config: {
                ...currentSettings.nfeio_config,
                companyId: "fec1854455894d6b8efe72a2ef6cd43a"
            }
        };

        console.log("Attempting PATCH request...");
        const response = await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            settings: newSettings
        }, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation' // This makes Supabase return the updated rows!
            }
        });
        
        console.log("PATCH status:", response.status);
        console.log("PATCH returned data:", JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error("PATCH error:", err.response?.status, err.response?.data || err.message);
    }
}

testPatch();
