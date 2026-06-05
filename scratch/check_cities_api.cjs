const axios = require('axios');

async function check() {
    const cities = ['2400208', '2400802', '2408102'];
    const names = ['Açu', 'Angicos', 'Natal'];

    for (let i = 0; i < cities.length; i++) {
        const ibge = cities[i];
        const name = names[i];
        try {
            const response = await axios.get(`https://api.plugnotas.com.br/nfse/cidades/${ibge}`, {
                headers: {
                    'x-api-key': '2da392a6-79d2-4304-a8b7-959572c7e44d'
                }
            });
            console.log(`\n=== CITY: ${name} (IBGE: ${ibge}) ===`);
            console.log(`padrao: ${response.data.padrao}`);
            console.log(`certificado: ${response.data.certificado}`);
            console.log(`login: ${response.data.login}`);
            console.log(`senha: ${response.data.senha}`);
            console.log(`multiservicos: ${response.data.multiservicos}`);
            console.log(`dadosObrigatoriosNotasTomadas:`, response.data.dadosObrigatoriosNotasTomadas);
        } catch (e) {
            console.error(`ERROR FOR ${name}:`, e.response?.data || e.message);
        }
    }
}

check();
