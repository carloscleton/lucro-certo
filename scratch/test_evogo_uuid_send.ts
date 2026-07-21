import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function test() {
    const instanceId = '4c4f7061-e140-4b52-bcaf-b78a80081718'; // UUID for CARLOS
    const number = '558498071213';
    const mediaUrl = 'https://lucrocertovercel-11exnl53f-carloscletons-projects.vercel.app/api/fiscal-module/nfse/6a49095417170f0b5470d54b/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7';

    console.log(`Sending to Evolution GO using UUID: ${EVOLUTION_GO_API_URL}/message/sendMedia/${instanceId}...`);
    try {
        const response = await axios.post(`${EVOLUTION_GO_API_URL}/message/sendMedia/${instanceId}`, {
            number: number,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: 'Teste via UUID',
            media: mediaUrl,
            fileName: 'NotaFiscal.pdf'
        }, {
            headers: {
                'apikey': EVOLUTION_GO_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        console.log('Success! Response:', response.data);
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2));
    }
}

test();
