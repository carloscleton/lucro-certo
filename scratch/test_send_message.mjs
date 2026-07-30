import axios from 'axios';

async function trySend(token, label) {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';
    const number = '5521959189126'; // SLIN number

    try {
        console.log(`[${label}] Trying to send message using token: ${token}...`);
        const res = await axios.post(`${url}/message/sendText/${instanceName}`, {
            number: number,
            text: `Teste de envio (${label}) pelo script de depuração.`
        }, {
            headers: {
                'apikey': token,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[${label}] SUCCESS:`, res.data);
        return true;
    } catch (err) {
        console.log(`[${label}] FAILED:`, err.response?.status, err.response?.data || err.message);
        return false;
    }
}

async function run() {
    const globalKey = '7c4678985d13dfd7a89d4e56e7503563';
    const tokenBC = 'DEC54FF869FA-0DCF-8DED-902C2B4160BC';
    const token8C = 'DEC54FF869FA-0DCF-8DED-902C2B41608C';

    console.log('--- TEST 1: Global Key ---');
    await trySend(globalKey, 'Global Key');

    console.log('\n--- TEST 2: Token ending in BC ---');
    await trySend(tokenBC, 'Token BC');

    console.log('\n--- TEST 3: Token ending in 8C ---');
    await trySend(token8C, 'Token 8C');
}

run();
