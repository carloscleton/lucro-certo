import axios from 'axios'

async function test() {
    const vercelUrl = 'https://lucrocertoweb-carloscletons-projects.vercel.app/api/whatsapp/send';
    const payload = {
        instanceName: 'SLIN',
        number: '5582991136066', // or whatever number
        text: 'Teste de envio',
        mediaUrl: 'https://lucrocertoweb-carloscletons-projects.vercel.app/api/fiscal-module/nfsenac/AVULSA_1783166447469_7676/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7',
        mediaType: 'document',
        mimetype: 'application/pdf',
        fileName: 'NotaFiscal.pdf'
    };

    try {
        console.log(`Sending POST to ${vercelUrl}...`);
        const response = await axios.post(vercelUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Success:', response.data);
    } catch (err: any) {
        console.error('Status:', err.response?.status);
        console.error('Error detail:', JSON.stringify(err.response?.data, null, 2));
    }
}

test();
