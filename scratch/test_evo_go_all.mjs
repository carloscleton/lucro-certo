import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function test() {
    try {
        console.log('Fetching all instances...');
        const response = await axios.get(`${EVOLUTION_GO_API_URL}/instance/all`, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY
            }
        });
        console.log('Instances:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

test();
