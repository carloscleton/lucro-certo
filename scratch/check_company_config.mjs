import axios from 'axios';

const API_KEY = '2da392a6-79d2-4304-a8b7-959572c7e44d';
const SANDBOX_BASE = 'https://api.sandbox.plugnotas.com.br';
const CNPJ = '08187168000160';

async function check() {
    try {
        const response = await axios.get(`${SANDBOX_BASE}/empresa/${CNPJ}`, {
            headers: { 'x-api-key': API_KEY }
        });
        console.log("COMPANY CONFIG:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("ERROR:", e.response?.data || e.message);
    }
}

check();
