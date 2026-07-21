import axios from 'axios';

const EVOLUTION_API_URL = 'https://evo.idealzap.com.br';
const INSTANCE_TOKEN = 'A4274803DD7B-98EC-1541-16B57333409C'; // Token for SLIN
const INSTANCE_NAME = 'SLIN';
const RECIPIENT = '558498071213';

async function testFallback() {
    const systemPdfNoToken = 'https://lucrocertoweb-carloscletons-projects.vercel.app/api/fiscal-module/nfsenac/AVULSA_1783166447469_7676/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    const text = 'Olá! Sua nota fiscal foi emitida.';
    const encodedName = encodeURIComponent(INSTANCE_NAME);

    console.log('1. Attempting to send media...');
    try {
        const response = await axios.post(`${EVOLUTION_API_URL}/message/sendMedia/${encodedName}`, {
            number: RECIPIENT,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: text,
            media: systemPdfNoToken,
            fileName: 'NotaFiscal.pdf'
        }, {
            headers: {
                'apikey': INSTANCE_TOKEN,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        console.log('Media Send Success!', response.data);
    } catch (mediaErr: any) {
        console.log(`⚠️ Media send failed (as expected). Error status: ${mediaErr.response?.status}. Error msg: ${mediaErr.response?.data?.response?.message || mediaErr.message}`);
        console.log('2. Falling back to send text...');
        
        let textToSend = text;
        if (systemPdfNoToken && !textToSend.includes(systemPdfNoToken)) {
            textToSend = `${textToSend}\n\nLink do PDF: ${systemPdfNoToken}`.trim();
        }

        try {
            const textResponse = await axios.post(`${EVOLUTION_API_URL}/message/sendText/${encodedName}`, {
                number: RECIPIENT,
                text: textToSend,
                linkPreview: true
            }, {
                headers: {
                    'apikey': INSTANCE_TOKEN,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log('Text Send Success (Fallback)!', textResponse.data);
        } catch (textErr: any) {
            console.error('Text Send Failed!', textErr.response?.status, textErr.response?.data || textErr.message);
        }
    }
}

testFallback();
