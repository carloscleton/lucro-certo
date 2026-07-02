const axios = require('axios');

async function addSeries() {
    const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
    const cnpj = '08187168000160';
    
    try {
        console.log(`Fetching current config of test company ${cnpj}...`);
        const responseGet = await axios.get(`https://api.sandbox.plugnotas.com.br/empresa/${cnpj}`, {
            headers: { 'x-api-key': apiKey }
        });
        
        const currentData = responseGet.data;
        
        if (!currentData.nfse) currentData.nfse = { config: {} };
        if (!currentData.nfse.config) currentData.nfse.config = {};
        if (!currentData.nfse.config.rps) currentData.nfse.config.rps = {};
        
        currentData.nfse.config.rps.numeracao = [
            {
                serie: "1",
                numero: 1
            }
        ];
        
        // Clean up wrong key we added earlier
        delete currentData.nfse.config.numeracao;
        
        delete currentData._id;
        delete currentData.createdAt;
        delete currentData.updatedAt;
        
        console.log(`Sending PATCH to update test company ${cnpj} with nested rps.numeracao...`);
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

addSeries();
