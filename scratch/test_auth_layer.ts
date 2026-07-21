import axios from 'axios';

const url = 'https://evogo.idealzap.com.br';
const globalApiKey = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
const instanceToken = 'F62721C5BBA0-7112-767D-E7FA564A10CE';
const instanceUUID = '884af485-4414-4a63-905d-37c669c54eeb'; // Note: check UUID
const instanceName = 'Carloscleton';

async function tryGet(label: string, endpoint: string, headers: any) {
    try {
        const res = await axios.get(`${url}${endpoint}`, { headers, timeout: 3000 });
        console.log(`✅ [${label}] SUCCESS:`, typeof res.data === 'object' ? Object.keys(res.data) : res.data);
    } catch (e: any) {
        console.log(`❌ [${label}] FAILED:`, e.response?.data || e.message);
    }
}

async function tryPost(label: string, endpoint: string, body: any, headers: any) {
    try {
        const res = await axios.post(`${url}${endpoint}`, body, { headers, timeout: 3000 });
        console.log(`✅ [${label}] SUCCESS:`, typeof res.data === 'object' ? Object.keys(res.data) : res.data);
    } catch (e: any) {
        console.log(`❌ [${label}] FAILED:`, e.response?.data || e.message);
    }
}

async function runTests() {
    console.log('--- GET /instance/all ---');
    await tryGet('instance/all + globalApiKey', '/instance/all', { 'apikey': globalApiKey });
    await tryGet('instance/all + instanceToken', '/instance/all', { 'apikey': instanceToken });

    console.log('\n--- POST /instance/connect ---');
    // Connect requires apikey header
    await tryPost('connect + globalApiKey', '/instance/connect', { id: instanceName }, { 'apikey': globalApiKey });
    await tryPost('connect + instanceToken', '/instance/connect', { id: instanceName }, { 'apikey': instanceToken });
}

runTests();
