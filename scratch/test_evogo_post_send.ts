import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function test() {
    const number = '558498071213';
    const mediaUrl = 'https://lucrocertovercel-11exnl53f-carloscletons-projects.vercel.app/api/fiscal-module/nfse/6a49095417170f0b5470d54b/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7';

    // We will try calling POST /message/sendMedia with the instance in the body.
    const url = `${EVOLUTION_GO_API_URL}/message/sendMedia`;
    console.log(`Sending POST to ${url}...`);

    // Let's test with payload:
    const payload = {
        instance: 'CARLOS',
        number: number,
        mediatype: 'document',
        mimetype: 'application/pdf',
        caption: 'Teste via Evolution GO POST',
        media: mediaUrl,
        fileName: 'NotaFiscal.pdf'
    };

    try {
        const response = await axios.post(url, payload, {
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
