import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = '09FAB91AB9CD-6C34-A727-A2C2EEDC6FD0'; // Current Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';
const RECIPIENT = '5584998071213';

async function testGoRealBase64() {
    const url = `${EVOLUTION_GO_API_URL}/send/media`;
    console.log(`\n--- Test Evolution GO /send/media using Real PDF Base64 ---`);
    try {
        // 1. Download real PDF
        console.log('Downloading real dummy PDF...');
        const pdfRes = await axios.get('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', {
            responseType: 'arraybuffer'
        });
        const realBase64 = Buffer.from(pdfRes.data).toString('base64');
        console.log(`PDF downloaded successfully! Length: ${realBase64.length} chars.`);

        // 2. Send via Evolution GO
        console.log('Sending via Evolution GO...');
        const response = await axios.post(url, {
            id: INSTANCE_NAME,
            number: RECIPIENT,
            url: realBase64, // Real Base64 PDF!
            type: 'document',
            filename: 'NotaFiscal-GO-RealBase64.pdf',
            caption: 'Teste de PDF via Real Base64 (Evo GO)'
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

testGoRealBase64();
