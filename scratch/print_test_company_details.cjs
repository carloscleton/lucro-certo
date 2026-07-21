const axios = require('axios');

const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';

async function check() {
    try {
        const cnpj = '00893566000190';
        const res = await axios.get(`https://api.sandbox.plugnotas.com.br/empresa/${cnpj}`, {
            headers: { 'x-api-key': apiKey }
        });
        console.log(`CNPJ ${cnpj} full details:`, JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

check();
