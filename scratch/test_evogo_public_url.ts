import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = '5FD2DBE29232-9FCE-8CD1-500DC0E5F46D'; // New Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '558498071213';

async function testGoPublicUrl() {
    const url = `${EVOLUTION_GO_API_URL}/send/media`;
    console.log(`\n--- Test Evolution GO /send/media using Public PDF URL ---`);
    try {
        const response = await axios.post(url, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            type: 'document',
            filename: 'NotaFiscal-GO-Publico.pdf',
            caption: 'Teste de PDF via URL publica (Evo GO)'
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

testGoPublicUrl();
