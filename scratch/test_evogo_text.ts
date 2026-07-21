import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = '5D8ACD6D3319-C24C-F105-B71EE1ED17E1'; // Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '5584998071213'; // With 9!

async function testGoText() {
    const url = `${EVOLUTION_GO_API_URL}/send/text`;
    console.log(`\n--- Test Evolution GO /send/text (with 9) ---`);
    try {
        const response = await axios.post(url, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            text: 'Olá! Este é um teste de texto simples via Evolution GO. Por favor, confirme se você recebeu.'
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        console.log('Success!', response.data);
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2) || err.message);
    }
}

testGoText();
