import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'DB0A53E9D28D-DC76-A353-2402ABE1470B'; // Instance Token for CARLOS

async function test() {
    const instanceName = 'CARLOS';
    const number = '558498071213';
    const mediaUrl = 'https://lucrocertovercel-11exnl53f-carloscletons-projects.vercel.app/api/fiscal-module/nfse/6a49095417170f0b5470d54b/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7';

    const url = `${EVOLUTION_GO_API_URL}/send/media`;
    console.log(`Sending POST to ${url}...`);

    const payload = {
        id: instanceName, // Instance name or UUID
        number: number,
        url: mediaUrl,
        type: 'document',
        filename: 'NotaFiscal.pdf',
        caption: 'Teste via Evolution GO /send/media'
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
