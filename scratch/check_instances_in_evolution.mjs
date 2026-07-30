import axios from 'axios';

const URL = 'https://evo.idealzap.com.br';
const KEY = '7c4678985d13dfd7a89d4e56e7503563';

async function check() {
    try {
        console.log('Fetching standard Evolution instances...');
        const res = await axios.get(`${URL}/instance/fetchInstances`, {
            headers: { 'apikey': KEY }
        });
        console.log('Instances:', res.data);
    } catch (err) {
        console.log('FAILED:', err.response?.status, err.response?.data || err.message);
    }
}

check();
