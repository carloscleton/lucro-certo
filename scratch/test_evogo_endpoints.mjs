import axios from 'axios';

async function testGoEndpoints() {
    const url = 'https://evogo.idealzap.com.br';
    const apiKey = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

    const endpoints = [
        '/instance/fetchInstances',
        '/instance/all',
        '/instance/fetch'
    ];

    for (const ep of endpoints) {
        try {
            console.log(`Trying ${url}${ep}...`);
            const res = await axios.get(`${url}${ep}`, {
                headers: { 'apikey': apiKey }
            });
            console.log(`[${ep}] SUCCESS:`, res.status, typeof res.data);
        } catch (err) {
            console.log(`[${ep}] FAILED:`, err.response?.status, err.response?.data || err.message);
        }
    }
}

testGoEndpoints();
