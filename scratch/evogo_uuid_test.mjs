// Verificar swagger da EvoGo e buscar por UUID
import axios from 'axios';

const BASE = 'https://evogo.idealzap.com.br';
const KEY = 'fe079bb46dea5a9a0d08df7f2c9ff9ff';
const headers = { 'apikey': KEY };

// O UUID da instância TESTE que aparece na imagem (sem espaços, com dashes)
// Da imagem: E7512F40BA48 D294 E8EF ABF141180188
// Formatos possíveis:
const possibleIds = [
    'E7512F40-BA48-D294-E8EF-ABF141180188',  // UUID padrão
    'e7512f40-ba48-d294-e8ef-abf141180188',  // lowercase
    'E7512F40BA48D294E8EFABF141180188',      // sem dashes
];

async function test() {
    // Checar swagger
    try {
        const r = await axios.get(`${BASE}/swagger/doc.json`, { headers });
        console.log('✅ Swagger encontrado!');
        const paths = Object.keys(r.data.paths || {});
        console.log('Endpoints disponíveis:', paths.join('\n'));
    } catch(e) {
        console.log('❌ /swagger/doc.json:', e.response?.status);
    }

    try {
        const r = await axios.get(`${BASE}/swagger/swagger.json`, { headers });
        console.log('✅ Swagger v2 encontrado!');
        const paths = Object.keys(r.data.paths || {});
        console.log('Endpoints disponíveis:', paths.join('\n'));
    } catch(e) {
        console.log('❌ /swagger/swagger.json:', e.response?.status);
    }

    // Testar GET /instance/info/{uuid}
    for (const id of possibleIds) {
        try {
            const r = await axios.get(`${BASE}/instance/info/${id}`, { headers });
            console.log(`✅ GET /instance/info/${id}:`, r.status, JSON.stringify(r.data, null, 2));
        } catch(e) {
            console.log(`❌ GET /instance/info/${id}:`, e.response?.status, JSON.stringify(e.response?.data)?.substring(0, 100));
        }
    }
}

test();
