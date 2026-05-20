const https = require('https');

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0';
const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';

const url = `${supabaseUrl}/rest/v1/companies?id=eq.${companyId}&select=id,tecnospeed_config,fiscal_module_enabled`;

const options = {
    headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
    }
};

https.get(url, options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        try {
            console.log('Company Config:', JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.error('Raw response data:', data);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err);
});
