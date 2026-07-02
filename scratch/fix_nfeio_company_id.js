import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function fix() {
    try {
        const companyId = "84d1586e-5d0c-456f-aa12-aefc5a9364a7";
        console.log(`🔍 Fetching current company settings for ID: ${companyId}...`);
        
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (response.data.length === 0) {
            console.log("❌ Company not found.");
            return;
        }
        
        const company = response.data[0];
        const currentSettings = company.settings || {};
        
        if (!currentSettings.nfeio_config) {
            console.log("❌ nfeio_config not found in company settings.");
            return;
        }
        
        console.log("Current companyId in nfeio_config:", currentSettings.nfeio_config.companyId);
        
        // Update the companyId to the correct NFe.io Company ID
        const newSettings = {
            ...currentSettings,
            nfeio_config: {
                ...currentSettings.nfeio_config,
                companyId: "fec1854455894d6b8efe72a2ef6cd43a"
            }
        };
        
        console.log("Updating company settings...");
        await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            settings: newSettings
        }, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log("✅ Company settings updated successfully!");
    } catch (err) {
        console.error("❌ Error:", err.response?.data || err.message);
    }
}

fix();
