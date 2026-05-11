import axios from 'axios';

const API_KEY = '2da392a6-79d2-4304-a8b7-959572c7e44d';
const CNPJ = '00893566000190';
const BASE_URL = 'https://api.sandbox.plugnotas.com.br';

async function check() {
    try {
        console.log(`Checking issuer ${CNPJ}...`);
        const response = await axios.get(`${BASE_URL}/empresa/${CNPJ}`, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Issuer Data:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

check();
