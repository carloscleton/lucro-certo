import axios from 'axios'

async function test() {
    const baseUrl = 'https://evogo.idealzap.com.br';
    const token = 'BE81A41B7BE2-D9B9-0097-5DC0B9112816'; // CLETON token

    console.log('1. Calling POST /instance/connect...');
    try {
        const connectRes = await axios.post(`${baseUrl}/instance/connect`, {}, {
            headers: { 'apikey': token }
        });
        console.log('Connect success! Response:', connectRes.data);
    } catch (err: any) {
        console.error('Connect failed. Status:', err.response?.status);
        console.error('Connect failed. Detail:', JSON.stringify(err.response?.data, null, 2) || err.message);
    }

    console.log('\n2. Calling GET /instance/qr...');
    try {
        const qrRes = await axios.get(`${baseUrl}/instance/qr`, {
            headers: { 'apikey': token }
        });
        console.log('QR success! Response:', qrRes.data);
    } catch (err: any) {
        console.error('QR failed. Status:', err.response?.status);
        console.error('QR failed. Detail:', JSON.stringify(err.response?.data, null, 2) || err.message);
    }
}

test();
