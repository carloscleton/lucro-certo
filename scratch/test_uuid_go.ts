import axios from 'axios';

const url = 'https://evogo.idealzap.com.br';
const globalApiKey = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
const instanceToken = 'F62721C5BBA0-7112-767D-E7FA564A10CE';
const instanceUUID = '8b4af485-4414-4a63-905d-37c669c54eeb';
const instanceName = 'Carloscleton';
const testNumber = '5521959189126'; // Num from screenshot

async function trySend(label: string, idVal: string, headers: any) {
    try {
        const res = await axios.post(`${url}/send/text`, {
            id: idVal,
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
    console.log('--- TESTING WITH UUID ---');
    await trySend('UUID + apikey: instanceToken', instanceUUID, { 'apikey': instanceToken });
    await trySend('UUID + apikey: globalApiKey', instanceUUID, { 'apikey': globalApiKey });
    await trySend('UUID + Authorization: globalApiKey', instanceUUID, { 'Authorization': globalApiKey });

    console.log('\n--- TESTING WITH NAME ---');
    await trySend('NAME + apikey: instanceToken', instanceName, { 'apikey': instanceToken });
    await trySend('NAME + apikey: globalApiKey', instanceName, { 'apikey': globalApiKey });
}

runTests();
