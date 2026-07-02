const axios = require('axios');

async function sync() {
    const apiKey = '2da392a6-79d2-4304-a8b7-959572c7e44d';
    const id = '69792a480d7bf8bc1b010189';
    const cnpj = '00893566000190';
    
    const payload = {
        cpfCnpj: cnpj,
        inscricaoMunicipal: '123456',
        razaoSocial: 'CARLOSCLETON CARVALHO FERNANDES ME',
        nomeFantasia: 'SERVICE LINE INFORMATICA',
        simplesNacional: true,
        regimeTributario: 1,
        email: 'carloscleton.nat@gmail.com',
        certificado: '6a29b5d4c31d5bfddc1777a0',
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

    console.log(`Updating real company using ID ${id} to set nfseNacional: true...`);
    try {
        const response = await axios.put(`https://api.sandbox.plugnotas.com.br/empresa/${id}`, payload, {
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
