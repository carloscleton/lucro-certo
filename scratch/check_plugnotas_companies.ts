import axios from 'axios'

const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d'

async function check() {
    const cnpjs = ['08187168000160', '08184315000104', '00893566000190'];
    for (const cnpj of cnpjs) {
        try {
            console.log(`Fetching details for CNPJ ${cnpj}...`);
            const res = await axios.get(`https://api.sandbox.plugnotas.com.br/empresa/${cnpj}`, {
                headers: { 'x-api-key': apiKey }
            });
            console.log(`CNPJ ${cnpj} details:`, JSON.stringify(res.data, null, 2));
        } catch (err: any) {
            console.error(`Error fetching CNPJ ${cnpj}:`, err.response?.data || err.message);
        }
    }
}

check();
