import axios from 'axios';
import https from 'https';

async function testWaha() {
    const url = 'https://waha.lucrocerto.com';
    const agent = new https.Agent({ rejectUnauthorized: false });

    try {
        console.log(`Querying: ${url}/api/sessions...`);
        const res = await axios.get(`${url}/api/sessions`, {
            httpsAgent: agent,
            timeout: 5000
        });
        console.log('REACHED! Sessions:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

testWaha();
