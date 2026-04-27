import dotenv from 'dotenv';
dotenv.config();

const url = 'https://oncddbarrtxalsmzravk.supabase.co/functions/v1/automation-dispatcher';

async function testTrigger() {
    console.log(`Triggering: ${url}`);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await res.json();
        console.log('Response Status:', res.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch Error:', err);
    }
}

testTrigger();
