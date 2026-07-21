import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const GLOBAL_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
const INSTANCE_TOKEN = '5D8ACD6D3319-C24C-F105-B71EE1ED17E1'; // Token for CCFERNANDES
const INSTANCE_NAME = 'CCFERNANDES';

async function testQr() {
    // 1. Try with instance token header and no query param
    console.log('\n--- Test 1: GET /instance/qr with instance token in header ---');
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/qr`, {
            headers: { 'apikey': INSTANCE_TOKEN }
        });
        console.log('Success Test 1!', res.data);
    } catch (err: any) {
        console.error('Test 1 Error:', err.response?.status, err.response?.data || err.message);
    }

    // 2. Try with global apikey and id in query param
    console.log('\n--- Test 2: GET /instance/qr?id=... with global API key ---');
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/qr`, {
            params: { id: INSTANCE_NAME },
            headers: { 'apikey': GLOBAL_API_KEY }
        });
        console.log('Success Test 2!', res.data);
    } catch (err: any) {
        console.error('Test 2 Error:', err.response?.status, err.response?.data || err.message);
    }

    // 3. Try with instance token and id in query param
    console.log('\n--- Test 3: GET /instance/qr?id=... with instance token ---');
    try {
        const res = await axios.get(`${EVOLUTION_GO_API_URL}/instance/qr`, {
            params: { id: INSTANCE_NAME },
            headers: { 'apikey': INSTANCE_TOKEN }
        });
        console.log('Success Test 3!', res.data);
    } catch (err: any) {
        console.error('Test 3 Error:', err.response?.status, err.response?.data || err.message);
    }
}

testQr();
