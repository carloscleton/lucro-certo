const axios = require('axios');

async function fixNacionalNumeracao() {
    try {
        const payload = {
            "inscricaoMunicipal": "8214100099",
            "nfse": {
                "ativo": true,
                "config": {
                    "producao": false,
                    "nfseNacional": true,
                    "rps": {
                        "numeracao": [
                            {
                                "numero": 1,
                                "serie": "1"
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
        console.log("FIX NUM SUCCESS:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("FIX NUM ERROR:", e.response?.data || e.message);
    }
}

fixNacionalNumeracao();
