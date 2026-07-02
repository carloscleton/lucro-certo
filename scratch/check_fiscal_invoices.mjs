import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function check() {
    try {
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
            params: {
                order: 'created_at.desc',
                limit: 20
            },
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        console.log("LAST 20 FISCAL INVOICES (ALL):");
        for (const invoice of response.data) {
            console.log(`- ID: ${invoice.id} | Company ID: ${invoice.company_id} | External ID: ${invoice.external_id} | Type: ${invoice.type} | Status: ${invoice.status} | Created: ${invoice.created_at}`);
        }
    } catch (e) {
        console.error("ERROR:", e.response?.data || e.message);
    }
}

check();
