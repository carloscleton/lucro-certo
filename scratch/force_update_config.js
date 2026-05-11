import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function forceUpdate() {
    try {
        const cnpj_procurado = "00893566000190";
        console.log(`🔍 Localizando empresa com CNPJ: ${cnpj_procurado}...`);
        
        // 1. Buscar a empresa
        const search = await axios.get(`${SUPABASE_URL}/rest/v1/companies?cnpj=eq.${cnpj_procurado}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        if (!search.data || search.data.length === 0) {
            console.log("❌ Empresa não encontrada. Tentando listar todas para achar o ID...");
            const list = await axios.get(`${SUPABASE_URL}/rest/v1/companies?select=id,cnpj,legal_name`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            console.log("📝 Empresas no banco:", JSON.stringify(list.data, null, 2));
            return;
        }

        const company = search.data[0];
        const companyId = company.id;
        console.log(`✅ Empresa encontrada! ID: ${companyId}`);

        // 2. Preparar os dados de teste da TecnoSpeed (Maringá)
        const testConfig = {
            ...company.tecnospeed_config,
            ambiente: 'homologacao',
            cnpj: '08184315000104',
            razao_social: 'TECNOSPEED TECNOLOGIA DA INFORMACAO LTDA',
            inscricao_municipal: '123456',
            inscricao_estadual: 'ISENTO',
            email: 'suporte@lucrocerto.com.br',
            telefone: '4430379500',
            endereco: {
                logradouro: 'Avenida Duque de Caxias',
                numero: '882',
                bairro: 'Zona 07',
                cep: '87020025',
                codigoCidade: '4115200',
                uf: 'PR',
                complemento: 'SALA 01'
            },
            endpoint_homologacao: 'https://api.sandbox.plugnotas.com.br',
            fiscal_module_enabled: true
        };

        // 3. Injetar no banco
        console.log("💾 Injetando dados de Maringá (Sandbox) no banco de dados...");
        await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            tecnospeed_config: testConfig
        }, {
            headers: { 
                'apikey': SUPABASE_KEY, 
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("✨ SUCESSO! Dados de teste injetados.");
        console.log("Dica: Recarregue a página no navegador para ver os novos dados.");

    } catch (err) {
        console.error("❌ Erro no script:", err.response?.data || err.message);
    }
}

forceUpdate();
