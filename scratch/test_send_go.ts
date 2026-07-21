import axios from 'axios';

const url = 'https://evogo.idealzap.com.br';
const globalApiKey = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
const instanceToken = 'F62721C5BBA0-7112-767D-E7FA564A10CE';
const instanceId = 'Carloscleton';
const testNumber = '5521959189126'; // Num from screenshot

async function runTests() {
    console.log('--- TEST 1: Sending with apikey = global admin API key ---');
    try {
        const res = await axios.post(`${url}/send/text`, {
            id: instanceId,
            number: testNumber,
            text: 'Teste 1: Global API Key'
        }, {
            headers: {
                'apikey': globalApiKey,
                'Content-Type': 'application/json'
            }
        });
        console.log('SUCCESS 1:', res.data);
    } catch (e: any) {
        console.error('FAILED 1:', e.response?.data || e.message);
    }

    console.log('\n--- TEST 2: Sending with apikey = instance token ---');
    try {
        const res = await axios.post(`${url}/send/text`, {
            id: instanceId,
            number: testNumber,
            text: 'Teste 2: Instance Token'
        }, {
            headers: {
                'apikey': instanceToken,
                'Content-Type': 'application/json'
            }
        });
        console.log('SUCCESS 2:', res.data);
    } catch (e: any) {
        console.error('FAILED 2:', e.response?.data || e.message);
    }
}

runTests();
