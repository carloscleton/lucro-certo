import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function check() {
    try {
        const cnpj = "00893566000190";
        console.log(`🔍 Buscando empresa com CNPJ: ${cnpj}...`);
        
        // Tentando buscar filtrando pelo CNPJ para contornar possíveis restrições de RLS se houver permissão para anon
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
            params: {
                cnpj: `eq.${cnpj}`,
                select: 'id,legal_name,cnpj,tecnospeed_config'
            },
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (response.data.length === 0) {
            console.log("⚠️ Nenhuma empresa encontrada com este CNPJ usando a chave anon.");
            
            // Tentar listar todas se a busca por CNPJ falhou em retornar
            const listAll = await axios.get(`${SUPABASE_URL}/rest/v1/companies?select=id,legal_name,cnpj`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            console.log("📝 Empresas encontradas:", JSON.stringify(listAll.data, null, 2));
        } else {
            console.log("✅ Empresa encontrada:");
            console.log(JSON.stringify(response.data, null, 2));
        }
    } catch (err) {
        console.error("❌ Erro:", err.response?.data || err.message);
    }
}

check();
