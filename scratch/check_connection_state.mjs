import axios from 'axios';

async function check() {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';
    const token = '9262020A2978-72EF-E807-6F519976F425';

    try {
        console.log('Fetching connection state...');
        const res = await axios.get(`${url}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': token }
        });
        console.log('Connection State:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

check();
