const axios = require('axios');

const API_KEY = '2da392a6-79d2-4304-a8b7-959572c7e44d';
const SANDBOX_BASE = 'https://api.sandbox.plugnotas.com.br';
const CNPJ = '08187168000160';

async function fixCompanyForNacional() {
    console.log(`\n⚙️ Ativando padrão NACIONAL e numeração automática para a empresa de teste: ${CNPJ}`);
    
    try {
        const patchPayload = {
            "nfse": {
                "ativo": true,
                "config": {
                    "rps": {
                        "numeracaoAutomatica": true,
                        "agrupaLoteComSerieAutomatico": true,
                        "numeracao": [
                            {
                                "serie": "1",
                                "numero": 1
                            }
                        ]
                    },
                    "producao": false,
                    "nfseNacional": true
                }
            }
        };

        const response = await axios.patch(`${SANDBOX_BASE}/empresa/${CNPJ}`, patchPayload, {
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log(`✅ SUCESSO na ativação Nacional de ${CNPJ}:`, JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error(`❌ ERRO na ativação Nacional de ${CNPJ}:`, e.response?.data || e.message);
    }
}

fixCompanyForNacional();
