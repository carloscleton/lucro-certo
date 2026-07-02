import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function check() {
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
            params: {
                select: 'id,legal_name,trade_name,cnpj,settings'
            },
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        for (const company of response.data) {
            if (company.settings && (company.settings.nfeio_config || company.settings.fiscal_provider === 'nfeio')) {
                console.log("Found NFe.io Company:");
                console.log("ID:", company.id);
                console.log("Legal Name:", company.legal_name);
                console.log("CNPJ:", company.cnpj);
                console.log("Settings:", JSON.stringify(company.settings, null, 2));
            }
        }
    } catch (e) {
        console.error("ERROR:", e.response?.data || e.message);
    }
}

check();
