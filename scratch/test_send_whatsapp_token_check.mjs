import axios from 'axios';

async function testToken(token) {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';

    try {
        console.log(`Testing token [${token}]...`);
        const res = await axios.get(`${url}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': token }
        });
        console.log(`Token [${token}] SUCCESS:`, res.data);
        return true;
    } catch (err) {
        console.log(`Token [${token}] FAILED:`, err.response?.status, err.response?.data || err.message);
        return false;
    }
}

async function run() {
    const tokenBC = 'DEC54FF869FA-0DCF-8DED-902C2B4160BC'; // from user dashboard
    const token8C = 'DEC54FF869FA-0DCF-8DED-902C2B41608C'; // from fetchInstances

    console.log('--- Testing token ending in BC ---');
    await testToken(tokenBC);

    console.log('\n--- Testing token ending in 8C ---');
    await testToken(token8C);
}

run();
