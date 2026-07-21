// Testa vários endpoints de busca de instâncias na EvoGo baseado no swagger
import axios from 'axios';

const BASE = 'https://evogo.idealzap.com.br';
const KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';

const headers = { 'apikey': KEY };

async function tryEndpoints() {
    const tests = [
        { method: 'GET', path: '/instance/TESTE' },
        { method: 'GET', path: '/instance/name/TESTE' },
        { method: 'GET', path: '/instances/TESTE' },
        { method: 'GET', path: '/instance/info?name=TESTE' },
        { method: 'GET', path: '/instance/info/TESTE' },
        { method: 'GET', path: '/instance?name=TESTE' },
        { method: 'POST', path: '/instance/info', body: { instanceName: 'TESTE' } },
        { method: 'POST', path: '/instance/list', body: {} },
        { method: 'GET', path: '/' },
    ];

    for (const t of tests) {
        try {
            let r;
            if (t.method === 'GET') {
                r = await axios.get(`${BASE}${t.path}`, { headers });
            } else {
                r = await axios.post(`${BASE}${t.path}`, t.body || {}, { headers });
            }
            console.log(`✅ ${t.method} ${t.path}: ${r.status}`);
            console.log(JSON.stringify(r.data, null, 2).substring(0, 500));
            console.log('---');
        } catch(e) {
            console.log(`❌ ${t.method} ${t.path}: ${e.response?.status} ${typeof e.response?.data === 'string' ? e.response.data.substring(0, 50) : JSON.stringify(e.response?.data)?.substring(0, 50)}`);
        }
    }
}

tryEndpoints();
