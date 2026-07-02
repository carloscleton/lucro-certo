import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function test() {
    try {
        console.log('Sending request to Evolution GO with name...');
        const response = await axios.post(`${EVOLUTION_GO_API_URL}/instance/create`, {
            name: 'TESTE_TEMP',
            token: '5E5255D6A0D5-1B35-8E7D-70355F2149E5',
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error Status:', error.response?.status);
        console.error('Error Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Error Message:', error.message);
    }
}

test();
