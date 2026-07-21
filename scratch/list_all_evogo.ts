import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function test() {
    try {
        console.log('Fetching all instances...');
        const response = await axios.get(`${EVOLUTION_GO_API_URL}/instance/all`, {
            headers: { 'apikey': EVOLUTION_GO_API_KEY }
        });
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error details:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
    }
}

test();
