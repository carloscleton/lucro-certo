import axios from 'axios';

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';

async function testQuery() {
    try {
        console.log('Testing with "and" query param...');
        const response1 = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
            params: {
                status: 'in.(concluido,autorizada,concluído)',
                and: '(created_at.gte.2026-06-01T00:00:00.000Z,created_at.lte.2026-06-18T23:59:59.999Z)',
                select: 'id',
                limit: 1
            },
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log('Success 1! Status:', response1.status, 'Data:', response1.data);
    } catch (error) {
        console.error('Failed 1! Status:', error.response?.status, 'Message:', error.response?.data || error.message);
    }

    try {
        console.log('Testing with original query param (simulating the bug)...');
        const response2 = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
            params: {
                status: 'in.(concluido,autorizada,concluído)',
                created_at: 'gte.2026-06-01T00:00:00.000Z&created_at.lte.2026-06-18T23:59:59.999Z',
                select: 'id',
                limit: 1
            },
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log('Success 2! Status:', response2.status, 'Data:', response2.data);
    } catch (error) {
        console.error('Failed 2! Status:', error.response?.status, 'Message:', error.response?.data || error.message);
    }
}

testQuery();
