const axios = require('axios');

async function syncSafe() {
    const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
    const cnpj = '08187168000160';
    
    try {
        console.log(`Fetching current config of test company ${cnpj}...`);
        const responseGet = await axios.get(`https://api.sandbox.plugnotas.com.br/empresa/${cnpj}`, {
            headers: { 'x-api-key': apiKey }
        });
        
        const currentData = responseGet.data;
        
        // Update only the nfse config
        if (!currentData.nfse) currentData.nfse = { config: {} };
        if (!currentData.nfse.config) currentData.nfse.config = {};
        
        currentData.nfse.config.nfseNacional = true;
        currentData.nfse.config.consultaNfseNacional = true;
        currentData.nfse.ativo = true;
        
        // Let's add a series specifically for national if it doesn't exist
        // or ensure numeracao has a series
        if (!currentData.nfse.config.numeracao) currentData.nfse.config.numeracao = [];
        if (currentData.nfse.config.numeracao.length === 0) {
            currentData.nfse.config.numeracao.push({
                serie: "1",
                numero: 1
            });
        }
        
        // Clean up read-only or unwanted fields
        delete currentData._id;
        delete currentData.createdAt;
        delete currentData.updatedAt;
        
        console.log(`Sending PATCH to update test company ${cnpj}...`);
        const responsePatch = await axios.patch(`https://api.sandbox.plugnotas.com.br/empresa/${cnpj}`, currentData, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            }
        });
        console.log("PATCH SUCCESS:", JSON.stringify(responsePatch.data, null, 2));
    } catch (e) {
        console.error("ERROR:", e.message, e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }
}

syncSafe();
