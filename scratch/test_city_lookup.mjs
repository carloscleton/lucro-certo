import axios from 'axios';

async function test() {
    const ibge = '2408102'; // Natal
    const companyId = 'c784f24f-92e7-4ff6-9951-d7327fb77028'; // RJ DECOR (has TecnoSpeed key)

    try {
        console.log(`Testing with companyId: ${companyId}...`);
        const res = await axios.get(`http://localhost:3001/fiscal-module/cidades/${ibge}`, {
            params: { companyId }
        });
        console.log('Success:', res.data);
    } catch (err) {
        console.error('Error:', err.response?.status, err.response?.data || err.message);
    }
}

test();
