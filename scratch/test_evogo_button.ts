import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = '09FAB91AB9CD-6C34-A727-A2C2EEDC6FD0'; // Current Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '5584998071213';

async function testGoButton() {
    const url = `${EVOLUTION_GO_API_URL}/send/button`;
    console.log(`\n--- Test Evolution GO /send/button ---`);
    try {
        const response = await axios.post(url, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            title: 'Nota Fiscal Disponível',
            description: 'Sua nota fiscal eletrônica foi gerada com sucesso. Clique no botão abaixo para visualizá-la.',
            footer: 'Lucro Certo',
            buttons: [
                {
                    type: 'url',
                    displayText: 'Visualizar PDF',
                    url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
                }
            ]
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

testGoButton();
