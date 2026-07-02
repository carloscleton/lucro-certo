const axios = require('axios');

async function sync() {
    const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
    const cnpj = '08187168000160';
    
    const payload = {
        cpfCnpj: cnpj,
        inscricaoMunicipal: '716',
        razaoSocial: 'Matriz Bento Gonçalves',
        simplesNacional: false,
        regimeTributario: 4,
        email: 'teste@mail.includer.local',
        certificado: '6a2c111f49286e972e90123e',
        nfse: {
            ativo: true,
            config: {
                producao: false,
                nfseNacional: true,
                consultaNfseNacional: true,
                rps: {
                    lote: 1,
                    numero: 1,
                    numeracao: [],
                    numeracaoAutomatica: true
                }
            }
        }
    };

    console.log(`Updating test company ${cnpj} using PATCH to set nfseNacional: true...`);
    try {
        const response = await axios.patch(`https://api.sandbox.plugnotas.com.br/empresa/${cnpj}`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            }
        });
        console.log("SUCCESS:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("ERROR:", e.message, e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }
}

sync();
