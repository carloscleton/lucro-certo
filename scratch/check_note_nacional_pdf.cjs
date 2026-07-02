const axios = require('axios');

async function checkNote() {
    const id = '6a2d729eb9c93ec394e8f3ca';
    const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
    
    console.log(`Checking status on /nfse/${id}...`);
    try {
        const response = await axios.get(`https://api.sandbox.plugnotas.com.br/nfse/${id}`, {
            headers: { 'x-api-key': apiKey }
        });
        console.log("STATUS SUCCESS:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("STATUS ERROR:", e.message, e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }

    console.log(`Downloading PDF on /nfse/pdf/${id}...`);
    try {
        const response = await axios.get(`https://api.sandbox.plugnotas.com.br/nfse/pdf/${id}`, {
            headers: { 'x-api-key': apiKey }
        });
        console.log("PDF DOWNLOAD SUCCESS! Response status:", response.status, "Length:", response.data?.length);
    } catch (e) {
        console.error("PDF DOWNLOAD ERROR:", e.message, e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }
}

checkNote();
