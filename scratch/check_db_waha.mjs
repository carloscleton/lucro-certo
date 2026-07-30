import axios from 'axios';

async function check() {
    const supabaseUrl = 'https://paozudwqrfnuvuhsylqi.supabase.co';
    const anonKey = process.env.SUPABASE_ANON_KEY;

    try {
        console.log('Querying all instances in database...');
        const res = await axios.get(`${supabaseUrl}/rest/v1/instances`, {
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`
            }
        });
        console.log('Instances in Database:');
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

check();
