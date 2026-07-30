import axios from 'axios';

async function testGo() {
    const url = 'https://evogo.idealzap.com.br';
    const apiKey = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

    try {
        console.log('Fetching from Evolution GO instance/all...');
        const res = await axios.get(`${url}/instance/all`, {
            headers: { 'apikey': apiKey }
        });
        console.log('SUCCESS:', res.status, JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

testGo();
