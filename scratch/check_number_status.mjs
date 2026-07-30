import axios from 'axios';

async function checkNumber(number) {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';
    const token = '9262020A2978-72EF-E807-6F519976F425';

    try {
        console.log(`Checking number: ${number}...`);
        const res = await axios.post(`${url}/chat/wasRegistered/${instanceName}`, {
            numbers: [number]
        }, {
            headers: {
                'apikey': token,
                'Content-Type': 'application/json'
            }
        });
        console.log('Result:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

checkNumber('5584998071213');
