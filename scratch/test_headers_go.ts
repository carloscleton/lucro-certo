import axios from 'axios';

const url = 'https://evogo.idealzap.com.br';
const globalApiKey = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
const instanceToken = 'F62721C5BBA0-7112-767D-E7FA564A10CE';
const instanceId = 'Carloscleton';
const testNumber = '5521959189126'; // Num from screenshot

async function trySend(label: string, headers: any) {
    try {
        const res = await axios.post(`${url}/send/text`, {
            id: instanceId,
            number: testNumber,
            text: `Teste: ${label}`
        }, { headers, timeout: 3000 });
        console.log(`✅ [${label}] SUCCESS:`, res.data);
        return true;
    } catch (e: any) {
        console.log(`❌ [${label}] FAILED:`, e.response?.data || e.message);
        return false;
    }
}

async function runTests() {
    console.log('--- TESTING INSTANCE TOKEN ---');
    await trySend('apikey: instanceToken', { 'apikey': instanceToken });
    await trySend('Authorization: Bearer instanceToken', { 'Authorization': `Bearer ${instanceToken}` });
    await trySend('Authorization: instanceToken', { 'Authorization': instanceToken });
    await trySend('token: instanceToken', { 'token': instanceToken });

    console.log('\n--- TESTING GLOBAL API KEY ---');
    await trySend('apikey: globalApiKey', { 'apikey': globalApiKey });
    await trySend('Authorization: Bearer globalApiKey', { 'Authorization': `Bearer ${globalApiKey}` });
    await trySend('Authorization: globalApiKey', { 'Authorization': globalApiKey });
    await trySend('token: globalApiKey', { 'token': globalApiKey });
}

runTests();
