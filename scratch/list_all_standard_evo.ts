import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const EVOLUTION_API_URL = 'https://evo.idealzap.com.br';
const EVOLUTION_API_KEY = '7c4678985d13dfd7a89d4e56e7503563';

async function test() {
    try {
        console.log('Fetching all standard instances...');
        const response = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error details:', err.response?.data ? JSON.stringify(err.response.data) : err.message);
    }
}

test();
