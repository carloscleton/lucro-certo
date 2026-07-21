import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const instanceToken = 'BE81A41B7BE2-D9B9-0097-5DC0B9112816';

async function test() {
    console.log('Testing /instance/get/{instanceId} with instance token...');
    
    // Test 1: UUID in path
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/get/ced298d1-5883-4fa8-8a6a-67c21140e2ec`, {
            headers: { 'apikey': instanceToken }
        });
        console.log('UUID in path response:', JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('UUID in path error:', err.response?.data || err.message);
    }

    // Test 2: Name in path
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/get/CLETON`, {
            headers: { 'apikey': instanceToken }
        });
        console.log('Name in path response:', JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error('Name in path error:', err.response?.data || err.message);
    }
}

test();
