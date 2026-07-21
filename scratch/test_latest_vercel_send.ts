import axios from 'axios'

async function test() {
    const vercelUrl = 'https://lucrocertovercel-carloscletons-projects.vercel.app/api/whatsapp/send';
    const payload = {
        instanceName: 'SLIN',
        number: '558498071213', // Number in user's modal
        text: 'Teste de envio pelo script na versão mais recente',
        mediaUrl: 'https://lucrocertovercel-11exnl53f-carloscletons-projects.vercel.app/api/fiscal-module/nfse/6a49095417170f0b5470d54b/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7',
        mediaType: 'document',
        mimetype: 'application/pdf',
        fileName: 'NotaFiscal.pdf',
        companyId: '84d1586e-5d0c-456f-aa12-aefc5a9364a7'
    };

    try {
        console.log(`Sending POST to ${vercelUrl}...`);
        const response = await axios.post(vercelUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Success! Result:', response.data);
    } catch (err: any) {
        console.error('Status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2));
    }
}

test();
