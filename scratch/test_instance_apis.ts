import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const instanceToken = 'BE81A41B7BE2-D9B9-0097-5DC0B9112816';

async function test() {
    console.log('Testing Evolution GO APIs with instance token...');
    
    // Test 1: GET /instance/status
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/status`, {
            headers: { 'apikey': instanceToken }
        });
        console.log('GET /instance/status response:', JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('GET /instance/status error:', err.response?.data || err.message);
    }

    // Test 2: GET /instance/connect
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/connect`, {
            headers: { 'apikey': instanceToken }
        });
        console.log('GET /instance/connect response:', JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('GET /instance/connect error:', err.response?.data || err.message);
    }
}

test();
