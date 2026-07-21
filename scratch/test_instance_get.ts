import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function test() {
    console.log('Fetching instance details by name using global admin key...');
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/get/CLETON`, {
            headers: { 'apikey': EVOLUTION_GO_API_KEY }
        });
        console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('Error:', err.response?.data || err.message);
    }
}

test();
