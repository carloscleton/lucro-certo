import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function test() {
    const instanceName = 'CARLOS';
    const number = '558498071213';
    const text = 'Teste de texto puro';

    const url = `${EVOLUTION_GO_API_URL}/message/sendText/${instanceName}`;
    console.log(`Sending text POST to ${url}...`);

    try {
        const response = await axios.post(url, {
            number: number,
            text: text
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log('Success! Response:', response.data);
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2) || err.message);
    }
}

test();
