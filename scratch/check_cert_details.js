import axios from 'axios';

const API_KEY = '2da392a6-79d2-4304-a8b7-959572c7e44d';
const CERT_ID = '5af59d271f6e8f409178fbf3';
const BASE_URL = 'https://api.sandbox.plugnotas.com.br';

async function check() {
    try {
        console.log(`Checking certificate ${CERT_ID}...`);
        const response = await axios.get(`${BASE_URL}/certificado/${CERT_ID}`, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log('Cert Data:', JSON.stringify(response.data, null, 2));
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

check();
