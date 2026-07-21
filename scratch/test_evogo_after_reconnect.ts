import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = '5D8ACD6D3319-C24C-F105-B71EE1ED17E1'; // Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '5584998071213';

async function testGoAfterReconnect() {
    console.log(`\n--- Test Evolution GO after user reconnect ---`);

    // 1. Test Text
    try {
        console.log('Sending text message...');
        const textRes = await axios.post(`${EVOLUTION_GO_API_URL}/send/text`, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            text: 'Olá! Este é um teste de texto simples da Evolution GO após a reconexão. Se você recebeu isso, a instância voltou a funcionar!'
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        console.log('Text Success:', textRes.data);
    } catch (err: any) {
        console.error('Text Error:', err.response?.data || err.message);
    }

    // 2. Test Media (using public PDF URL)
    try {
        console.log('\nSending media (public PDF URL)...');
        const mediaRes = await axios.post(`${EVOLUTION_GO_API_URL}/send/media`, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            type: 'document',
            filename: 'NotaFiscal-GO-Publico.pdf',
            caption: 'Aqui está o seu PDF de teste (URL Pública)'
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        console.log('Media Success:', mediaRes.data);
    } catch (err: any) {
        console.error('Media Error:', err.response?.data || err.message);
    }
}

testGoAfterReconnect();
