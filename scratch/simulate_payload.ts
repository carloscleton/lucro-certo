import axios from 'axios';

async function testLocalSend() {
    console.log('Sending message via local backend...');
    try {
        const res = await axios.post('http://localhost:3001/whatsapp/send', {
            instanceName: 'CCFERNANDES',
            token: '5D8ACD6D3319-C24C-F105-B71EE1ED17E1', // Pass correct token
            number: '5521959189126',
            text: 'Simulação de envio manual de Nota Fiscal via backend local (com token no body)',
            mediaUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            mediaType: 'document',
            mimetype: 'application/pdf',
            fileName: 'NotaFiscal.pdf',
            companyId: '84d1586e-5d0c-456f-aa12-aefc5a9364a7'
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Backend response:', res.data);
    } catch (e: any) {
        console.error('Backend failed:', e.response?.data || e.message);
    }
}

testLocalSend();
