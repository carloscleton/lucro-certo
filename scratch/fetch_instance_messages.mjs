import axios from 'axios';

async function fetchHistory() {
    const url = 'https://evo.idealzap.com.br';
    const instanceName = 'SLIN';
    const token = '9262020A2978-72EF-E807-6F519976F425';

    try {
        console.log('Fetching chats/messages...');
        const res = await axios.post(`${url}/chat/findMessages/${instanceName}`, {
            // Find messages
            limit: 20
        }, {
            headers: {
                'apikey': token,
                'Content-Type': 'application/json'
            }
        });
        console.log('Messages:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

fetchHistory();
