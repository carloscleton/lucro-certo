import axios from 'axios';

async function testRoot() {
    try {
        const res = await axios.get('https://evogo.idealzap.com.br/');
        console.log('Root:', res.status, res.data);
    } catch (err) {
        console.log('Root FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

testRoot();
