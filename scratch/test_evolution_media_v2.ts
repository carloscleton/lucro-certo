import axios from 'axios';

const EVOLUTION_API_URL = 'https://evo.idealzap.com.br';
const INSTANCE_TOKEN = 'A4274803DD7B-98EC-1541-16B57333409C'; // Token for SLIN
const INSTANCE_NAME = 'SLIN';
const RECIPIENT = '558498071213';

async function testSendMedia(caption: string, mediaUrl: string) {
    const url = `${EVOLUTION_API_URL}/message/sendMedia/${encodeURIComponent(INSTANCE_NAME)}`;
    console.log(`\n--- Test media send: ${caption} ---`);
    console.log(`URL: ${mediaUrl}`);
    try {
        const response = await axios.post(url, {
            number: RECIPIENT,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: caption,
            media: mediaUrl,
            fileName: 'NotaFiscal.pdf'
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

async function main() {
    // 1. URL pública válida de teste
    const publicPdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
    await testSendMedia('Teste PDF público', publicPdfUrl);

    // 2. URL de PDF do sistema sem Token (Retorna 401 Unauthorized)
    const systemPdfNoToken = 'https://lucrocertoweb-carloscletons-projects.vercel.app/api/fiscal-module/nfsenac/AVULSA_1783166447469_7676/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    await testSendMedia('Teste PDF sistema SEM Token (401)', systemPdfNoToken);
}

main();
