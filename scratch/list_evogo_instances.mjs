import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function check() {
    // Buscar instâncias via fetchInstances (endpoint correto)
    const endpoints = [
        '/instance/fetchInstances',
        '/instance/list',
        '/instances/list',
        '/instance',
        '/instances',
    ];

    for (const ep of endpoints) {
        try {
            const r = await axios.get(`${EVOLUTION_GO_API_URL}${ep}`, {
                headers: { 'apikey': EVOLUTION_GO_API_KEY }
            });
            console.log(`✅ ${ep} status: ${r.status}`);
            console.log(JSON.stringify(r.data, null, 2));
            break;
        } catch(e) {
            console.log(`❌ ${ep}: ${e.response?.status} ${JSON.stringify(e.response?.data)}`);
        }
    }

    // Limpar instância de teste criada
    const testName = `DEBUG_1783035763502`;
    try {
        const r = await axios.delete(`${EVOLUTION_GO_API_URL}/instance/${testName}`, {
            headers: { 'apikey': EVOLUTION_GO_API_KEY }
        });
        console.log(`\n🗑️ Instância ${testName} removida:`, r.status);
    } catch(e) {
        console.log(`\n❌ Falha ao remover ${testName}: ${e.response?.status}`);
    }
}

check();
