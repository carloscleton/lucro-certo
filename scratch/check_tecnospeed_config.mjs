import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function check() {
    try {
        const companyId = "84d1586e-5d0c-456f-aa12-aefc5a9364a7";
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        if (response.data.length > 0) {
            const company = response.data[0];
            console.log("Company ID:", company.id);
            console.log("Legal Name:", company.legal_name);
            console.log("CNPJ:", company.cnpj);
            console.log("tecnospeed_config:", JSON.stringify(company.tecnospeed_config, null, 2));
            console.log("settings:", JSON.stringify(company.settings, null, 2));
        } else {
            console.log("Company not found.");
        }
    } catch (e) {
        console.error("ERROR:", e.response?.data || e.message);
    }
}

check();
