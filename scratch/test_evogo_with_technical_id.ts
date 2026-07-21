import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const INSTANCE_TOKEN = '5D8ACD6D3319-C24C-F105-B71EE1ED17E1'; // Technical ID/Token for CCFERNANDES
const RECIPIENT = '5584998071213';

async function testGoTechnicalId() {
    const url = `${EVOLUTION_GO_API_URL}/send/text`;
    console.log(`\n--- Test Evolution GO /send/text using TECHNICAL ID in body ---`);
    try {
        const response = await axios.post(url, {
            id: INSTANCE_TOKEN, // Using the Technical ID instead of "CCFERNANDES"!
            number: RECIPIENT,
            text: 'Olá! Este é um teste da Evolution GO usando o ID técnico no corpo da requisição. Por favor, confirme se chegou.'
        }, {
            headers: {
                'apikey': INSTANCE_TOKEN,
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

testGoTechnicalId();
