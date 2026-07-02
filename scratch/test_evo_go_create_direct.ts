import axios from 'axios';

async function run() {
    const url = 'https://evogo.idealzap.com.br';
    const apiKey = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
    const name = 'TESTE_AG';
    const token = '12345678-1234-1234-1234-123456789012';

    const payload = {
        name: name,
        instanceName: name,
        token: token,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
    };

    try {
        console.log('Sending payload to Evolution GO:', JSON.stringify(payload, null, 2));
        const res = await axios.post(`${url}/instance/create`, payload, {
            headers: {
                'apikey': apiKey
            }
        });
        console.log('Response status:', res.status);
        console.log('Response data:', JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('Error status:', err.response?.status);
        console.error('Error data:', JSON.stringify(err.response?.data, null, 2));
        console.error('Error message:', err.message);
    }
}

run();
