import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = '5D8ACD6D3319-C24C-F105-B71EE1ED17E1'; // Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '5584998071213';

async function testGoStandardEndpoint() {
    const url = `${EVOLUTION_GO_API_URL}/message/sendMedia/${encodeURIComponent(INSTANCE_NAME)}`;
    console.log(`\n--- Test Evolution GO using standard Evolution API endpoint (/message/sendMedia/...) ---`);
    try {
        const response = await axios.post(url, {
            number: RECIPIENT,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: 'Teste via endpoint padrao no Evolution GO',
            media: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            fileName: 'NotaFiscal-GO-Std.pdf'
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

testGoStandardEndpoint();
