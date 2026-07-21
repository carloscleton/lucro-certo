import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const INSTANCE_TOKEN = '5D8ACD6D3319-C24C-F105-B71EE1ED17E1'; // Token for CCFERNANDES

async function forceLogoutAndConnect() {
    console.log('1. Calling DELETE /instance/logout...');
    try {
        const logoutRes = await axios.delete(`${EVOLUTION_GO_API_URL}/instance/logout`, {
            headers: { 'apikey': INSTANCE_TOKEN },
            timeout: 10000
        });
        console.log('Logout Success:', logoutRes.data);
    } catch (err: any) {
        console.warn('Logout failed (may already be logged out):', err.response?.data || err.message);
    }

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n2. Calling POST /instance/connect...');
    try {
        const connectRes = await axios.post(`${EVOLUTION_GO_API_URL}/instance/connect`, {
            webhookUrl: '',
            subscribe: ['MESSAGE']
        }, {
            headers: { 'apikey': INSTANCE_TOKEN },
            timeout: 10000
        });
        console.log('Connect Success:', connectRes.data);
    } catch (err: any) {
        console.warn('Connect failed:', err.response?.data || err.message);
    }

    // Wait 3 seconds
    console.log('\nWaiting 3 seconds for QR code to generate...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('3. Calling GET /instance/qr...');
    try {
        const qrRes = await axios.get(`${EVOLUTION_GO_API_URL}/instance/qr`, {
            headers: { 'apikey': INSTANCE_TOKEN }
        });
        console.log('QR Success! Code:', qrRes.data?.data?.Code || qrRes.data?.data?.code);
        console.log('Qrcode (prefix):', qrRes.data?.data?.Qrcode?.substring(0, 50) || qrRes.data?.data?.base64?.substring(0, 50));
    } catch (err: any) {
        console.error('QR Error:', err.response?.status, err.response?.data || err.message);
    }
}

forceLogoutAndConnect();
