import axios from 'axios';

const EVOLUTION_API_URL = 'https://evo.idealzap.com.br';
const EVOLUTION_API_KEY = '7c4678985d13dfd7a89d4e56e7503563';
const INSTANCE_NAME = 'carlos'; // Open standard instance

async function testSendMedia(number: string, mediaUrl: string) {
    const url = `${EVOLUTION_API_URL}/message/sendMedia/${encodeURIComponent(INSTANCE_NAME)}`;
    console.log(`\n--- Test sendMedia to ${number} with URL: ${mediaUrl} ---`);
    try {
        const response = await axios.post(url, {
            number: number,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: 'Teste de envio de PDF',
            media: mediaUrl,
            fileName: 'NotaFiscal-Teste.pdf'
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        console.log('Success!', response.data);
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2) || err.message);
    }
}

async function testSendText(number: string, text: string) {
    const url = `${EVOLUTION_API_URL}/message/sendText/${encodeURIComponent(INSTANCE_NAME)}`;
    console.log(`\n--- Test sendText to ${number} ---`);
    try {
        const response = await axios.post(url, {
            number: number,
            text: text,
            linkPreview: true
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        console.log('Success!', response.data);
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2) || err.message);
    }
}

async function main() {
    const number1 = '558498071213'; // JID without 9th digit
    const number2 = '5584998071213'; // With 9th digit
    
    // PDF URL without token (Will return 401 Unauthorized)
    const mediaUrlNoToken = 'https://lucrocertovercel-carloscletons-projects.vercel.app/api/fiscal-module/nfse/6a49095417170f0b5470d54b/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    
    // Let's test text send to both first
    await testSendText(number1, 'Teste texto para número sem o 9');
    await testSendText(number2, 'Teste texto para número com o 9');

    // Let's test media send
    await testSendMedia(number1, mediaUrlNoToken);
}

main();
