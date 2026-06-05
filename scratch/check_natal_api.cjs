const axios = require('axios');

async function check() {
    try {
        const response = await axios.get('https://api.plugnotas.com.br/nfse/cidades/2408102', {
            headers: {
                'x-api-key': '2da392a6-79d2-4304-a8b7-959572c7e44d'
            }
        });
        console.log("PRODUCTION API RESPONSE:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("PRODUCTION API ERROR STATUS:", e.response?.status);
        console.error("PRODUCTION API ERROR DATA:", e.response?.data);
    }

    try {
        const response = await axios.get('https://api.sandbox.plugnotas.com.br/nfse/cidades/2408102', {
            headers: {
                'x-api-key': '2da392a6-79d2-4304-a8b7-959572c7e44d'
            }
        });
        console.log("SANDBOX API RESPONSE:");
        console.log(JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("SANDBOX API ERROR STATUS:", e.response?.status);
        console.error("SANDBOX API ERROR DATA:", e.response?.data);
    }
}

check();
