const axios = require('axios');

async function fixNacional() {
    try {
        const payload = {
            "nfse": {
                "ativo": true,
                "config": {
                    "nfseNacional": true,
                    "rps": {
                        "numeracaoAutomatica": true,
                        "numeracao": [
                            {
                                "serie": "1",
                                "numero": 1
                            }
                        ]
                    }
                }
            }
        };

        const response = await axios.patch('https://api.sandbox.plugnotas.com.br/empresa/08187168000160', payload, {
            headers: {
                'x-api-key': '2da392a6-79d2-4304-a8b7-959572c7e44d',
                'Content-Type': 'application/json'
            }
        });
        console.log("FIX NACIONAL SUCCESS:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("FIX NACIONAL ERROR:", e.response?.data || e.message);
    }
}

fixNacional();
