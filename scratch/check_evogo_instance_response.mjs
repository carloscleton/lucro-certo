import axios from 'axios';

const EVOLUTION_GO_API_URL = 'https://evogo.idealzap.com.br';
const EVOLUTION_GO_API_KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

async function check() {
    console.log('=== Verificando instância TESTE na EvoGo ===\n');

    // 1. Listar todas as instâncias
    try {
        const listResp = await axios.get(`${EVOLUTION_GO_API_URL}/instance`, {
            headers: { 'apikey': EVOLUTION_GO_API_KEY }
        });
        console.log('GET /instance (lista) status:', listResp.status);
        console.log('GET /instance resposta:', JSON.stringify(listResp.data, null, 2));
    } catch (e) {
        console.error('GET /instance falhou:', e.response?.status, JSON.stringify(e.response?.data));
    }

    console.log('\n---\n');

    // 2. Tentar GET /instances (plural)
    try {
        const listResp2 = await axios.get(`${EVOLUTION_GO_API_URL}/instances`, {
            headers: { 'apikey': EVOLUTION_GO_API_KEY }
        });
        console.log('GET /instances status:', listResp2.status);
        console.log('GET /instances resposta:', JSON.stringify(listResp2.data, null, 2));
    } catch (e) {
        console.error('GET /instances falhou:', e.response?.status, JSON.stringify(e.response?.data));
    }

    console.log('\n---\n');

    // 3. Tentar GET /instance/TESTE (pelo nome)
    try {
        const detailResp = await axios.get(`${EVOLUTION_GO_API_URL}/instance/TESTE`, {
            headers: { 'apikey': EVOLUTION_GO_API_KEY }
        });
        console.log('GET /instance/TESTE status:', detailResp.status);
        console.log('GET /instance/TESTE resposta:', JSON.stringify(detailResp.data, null, 2));
    } catch (e) {
        console.error('GET /instance/TESTE falhou:', e.response?.status, JSON.stringify(e.response?.data));
    }

    // 4. Simular criação e ver a resposta completa
    console.log('\n=== Simulando criação para ver resposta ===');
    const testName = `DEBUG_${Date.now()}`;
    try {
        const createResp = await axios.post(`${EVOLUTION_GO_API_URL}/instance/create`, {
            name: testName,
            token: 'MEUTOKEN123'
        }, {
            headers: { 'apikey': EVOLUTION_GO_API_KEY, 'Content-Type': 'application/json' }
        });
        console.log('POST /instance/create status:', createResp.status);
        console.log('POST /instance/create resposta COMPLETA:', JSON.stringify(createResp.data, null, 2));
        console.log('\nCampos extraídos:');
        console.log('  data.id:', createResp.data?.id);
        console.log('  data.data.id:', createResp.data?.data?.id);
        console.log('  data.token:', createResp.data?.token);
        console.log('  data.data.token:', createResp.data?.data?.token);
        console.log('  data.instanceId:', createResp.data?.instanceId);
    } catch (e) {
        console.error('POST /instance/create falhou:', e.response?.status, JSON.stringify(e.response?.data, null, 2));
    }
}

check();
