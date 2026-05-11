import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import { PaymentFactory } from './services/payments/PaymentFactory.js';

const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();
dotenv.config({ path: '../.env' }); // Fallback para o .env da raiz do projeto

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Configuração global do Axios para evitar travamentos (Timeout de 15s)
axios.defaults.timeout = 15000;
axios.interceptors.response.use(
    response => response,
    error => {
        if (error.code === 'ECONNABORTED') {
            console.error('[Proxy] Erro: Timeout na comunicação externa (serviço lento)');
        }
        return Promise.reject(error);
    }
);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-api-key'],
}));
app.use(express.json());

// Roteamento robusto: todas as rotas fiscais suportam prefixo /api ou direto.

// Evolution API Config
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY?.trim();

// Supabase Config for Fiscal Proxy
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();

if (!EVOLUTION_API_URL || EVOLUTION_API_URL.includes('sua-instancia')) {
    console.warn('⚠️ [WhatsApp Proxy] AVISO: EVOLUTION_API_URL não configurada corretamente ou usando valor padrão no .env');
}
if (!EVOLUTION_API_KEY || EVOLUTION_API_KEY.includes('sua-api-key')) {
    console.warn('⚠️ [WhatsApp Proxy] AVISO: EVOLUTION_API_KEY não configurada corretamente ou usando valor padrão no .env');
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('⚠️ [WhatsApp Proxy] AVISO: Credenciais do Supabase não encontradas no ambiente do servidor.');
}

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Middleware de autenticação (Simples para agora)
const authenticate = (req: any, res: any, next: any) => {
    // Aqui validaremos o JWT do Supabase no futuro
    next();
};

// Função global para limpar possíveis "sujeiras" de JSON colado por engano
const sanitizeKey = (val: any) => {
    if (!val) return '';
    let s = String(val).trim();
    // Remover aspas se for um JSON stringificado por engano
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    // Remover chaves se colaram o objeto inteiro
    if (s.includes('{') || s.includes(':')) {
        const match = s.match(/[a-f0-9-]{36}/i); // Tenta achar um UUID
        if (match) s = match[0];
    }
    return s.trim().toLowerCase();
};

// --- BLOCO FISCAL ---
// Movidos para o topo para garantir prioridade e depuração

app.get(['/fiscal-module/health', '/api/fiscal-module/health'], (req, res) => {
    res.json({ status: 'ok', service: 'fiscal-proxy', timestamp: new Date(), version: '1.0.10' });
});

app.post(['/fiscal-module/upload-certificate', '/api/fiscal-module/upload-certificate'], authenticate, upload.single('arquivo'), async (req: any, res) => {
    const { companyId, senha } = req.body;
    const authHeader = req.headers.authorization;
    const file = req.file;

    if (!companyId || !file || !senha) {
        return res.status(400).json({ error: 'companyId, arquivo e senha são obrigatórios' });
    }

    try {
        // Usar config enviada pelo frontend ou buscar no banco se não houver
        const bodyConfig = req.body.config ? (typeof req.body.config === 'string' ? JSON.parse(req.body.config) : req.body.config) : null;
        const config = bodyConfig || await getCompanyFiscalConfig(authHeader!, companyId);


        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();

        console.log(`🔐 DEBUG: Usando API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
        console.log(`🔐 DEBUG: Enviando para: ${baseUrl}`);

        const form = new FormData();
        
        // Envio simplificado para compatibilidade máxima com Sandbox
        form.append('arquivo', file.buffer, {
            filename: 'certificado.pfx'
        });
        form.append('senha', String(senha));
        form.append('email', 'suporte@lucrocerto.com.br'); // Campo as vezes exigido em sandbox

        console.log(`📡 [COMPATIBILIDADE] Enviando para: ${baseUrl}/certificado`);

        const response = await axios.post(`${baseUrl}/certificado`, form, {
            headers: {
                ...form.getHeaders(),
                'x-api-key': apiKey,
                'X-API-KEY': apiKey
            },
            timeout: 30000
        });

        const certData = response.data?.data || response.data;
        const certId = certData?.id;

        // SALVAR O ID E METADADOS DO CERTIFICADO NO BANCO DE DADOS LOCAL (JSONB na tabela companies)
        if (certId && SUPABASE_URL) {
            try {
                // 1. Buscar config atual para não sobrescrever outros campos
                const currentConfig = config || {};
                const updatedConfig = {
                    ...currentConfig,
                    certificado_id: certId,
                    certificado_vencimento: certData?.vencimento,
                    certificado_sujeito: certData?.sujeito || certData?.nome,
                    certificado_status: 'ativo',
                    ultima_atualizacao: new Date().toISOString()
                };

                // 2. Atualizar no Supabase
                await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                    tecnospeed_config: updatedConfig
                }, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY!,
                        'Authorization': authHeader!,
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`✅ Certificado (${certId}) e metadados salvos no JSONB.`);
            } catch (dbErr: any) {
                console.warn('⚠️ Não foi possível salvar metadados no banco local:', dbErr.message);
            }
        }

        // Retornar os dados completos para o frontend mostrar na hora
        res.json({
            message: 'Certificado processado com sucesso',
            id: certId,
            vencimento: certData?.vencimento,
            sujeito: certData?.sujeito || certData?.nome,
            status: 'ativo'
        });
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro no upload do certificado:', JSON.stringify(errorDetail, null, 2));
        res.status(error.response?.status || 500).json({ 
            error: 'Erro no upload do certificado', 
            detail: errorDetail,
            debug: {
                url: `${baseUrl}/certificado`,
                method: 'POST',
                headers_sent: Object.keys(form.getHeaders()),
                apiKey_provided: !!apiKey,
                file_info: {
                    name: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype
                }
            }
        });
    }
});

app.get(['/fiscal-module/issuer-status/:cpfCnpj', '/api/fiscal-module/issuer-status/:cpfCnpj'], authenticate, async (req, res) => {
    const { cpfCnpj } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const apiKey = config.tecnospeed_api_key?.trim().toLowerCase();
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();

        console.log(`🔍 Checking status for issuer ${cpfCnpj} in ${isSandbox ? 'SANDBOX' : 'PROD'}...`);

        const response = await axios.get(`${baseUrl}/empresa/${cpfCnpj}`, {
            headers: { 'X-API-KEY': apiKey }
        });

        const issuerData = response.data;
        
        // Se houver um ID de certificado, buscar os detalhes dele
        if (issuerData.data?.certificado && typeof issuerData.data.certificado === 'string') {
            try {
                const certResponse = await axios.get(`${baseUrl}/certificado/${issuerData.data.certificado}`, {
                    headers: { 'X-API-KEY': apiKey }
                });
                issuerData.data.certificado_detalhes = certResponse.data.data;
            } catch (certErr) {
                console.warn('⚠️ Não foi possível carregar detalhes do certificado:', issuerData.data.certificado);
            }
        }

        res.json(issuerData);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        const statusCode = error.response?.status || 500;
        console.error(`❌ Erro ao consultar emissor (Status ${statusCode}):`, JSON.stringify(errorDetail, null, 2));
        res.status(statusCode).json({ error: 'Erro ao consultar emissor na TecnoSpeed', detail: errorDetail });
    }
});

app.post(['/fiscal-module/emitir', '/api/fiscal-module/emitir'], authenticate, async (req, res) => {
    const { companyId, payload, type, quoteId } = req.body;
    const authHeader = req.headers.authorization;

    if (!companyId || !payload) {
        return res.status(400).json({ error: 'companyId e payload são obrigatórios' });
    }

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId);
        if (!config || !config.tecnospeed_api_key) {
            return res.status(400).json({ error: 'Configuração TecnoSpeed incompleta (API Key ausente).' });
        }
        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();

        const endpoint = type === 'nfse' ? 'nfse' : 'nfe';
        const finalPayload = Array.isArray(payload) ? payload : [payload];

        console.log(`🧾 [FISCAL] Emitindo ${endpoint.toUpperCase()} via PlugNotas (${isSandbox ? 'SANDBOX' : 'PROD'})`);
        
        const response = await axios.post(`${baseUrl}/${endpoint}`, finalPayload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            }
        });

        const externalId = response.data?.data?.id || response.data?.id;

        if (externalId && SUPABASE_URL) {
            try {
                await axios.post(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                    company_id: companyId,
                    quote_id: quoteId,
                    external_id: externalId,
                    type: endpoint,
                    status: 'processando',
                    payload: payload
                }, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY!,
                        'Authorization': authHeader!,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (dbErr: any) {
                console.warn('⚠️ Falha ao persistir nota no banco:', dbErr.message);
            }
        }

        res.json({ ...response.data, proxy_version: '1.0.10' });
    } catch (error: any) {
        res.status(error.response?.status || 500).json({ error: error.message, detail: error.response?.data });
    }
});

app.post(['/fiscal-module/sync-issuer', '/api/fiscal-module/sync-issuer'], authenticate, async (req, res) => {
    const { companyId, config } = req.body;
    const authHeader = req.headers.authorization;

    try {
        const cnpj = (config.cnpj || '').replace(/\D/g, '');
        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        
        if (!cnpj || !apiKey) {
            return res.status(400).json({ error: 'CNPJ e Chave API são obrigatórios para sincronizar.' });
        }

        const isSandbox = config.ambiente === 'homologacao';
        const useTestData = config.use_test_data === true && isSandbox;
        const TEST_CNPJ = '08184315000104';

        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const rawBase = isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase);
        const baseUrl = String(rawBase).toLowerCase().replace(/\/$/, '');

        // DADOS DE TESTE DA TECNOSPEED (MARINGÁ)
        const TECNOSPEED_TEST_DATA = {
            cnpj: TEST_CNPJ,
            razaoSocial: 'TECNOSPEED TECNOLOGIA DA INFORMACAO LTDA',
            inscricaoMunicipal: '123456',
            endereco: {
                logradouro: 'Avenida Duque de Caxias',
                numero: '882',
                bairro: 'Zona 07',
                cep: '87020025',
                codigoCidade: '4115200',
                uf: 'PR',
                complemento: 'SALA 01'
            }
        };

        const TEST_CNPJ_FORMATTED = '08.184.315/0001-04';
        const TEST_CNPJ_CLEAN = '08184315000104';

        const effectiveCnpj = useTestData ? TEST_CNPJ_FORMATTED : cnpj;

        const issuerPayload = {
            cpfCnpj: effectiveCnpj,
            cnpj: effectiveCnpj,
            cpf_cnpj: effectiveCnpj, 
            inscricaoEstadual: useTestData ? '' : ((config.inscricao_estadual || '').replace(/\D/g, '') || ''),
            inscricaoMunicipal: useTestData ? TECNOSPEED_TEST_DATA.inscricaoMunicipal : ((config.inscricao_municipal || '').replace(/\D/g, '') || ''),
            razaoSocial: useTestData ? TECNOSPEED_TEST_DATA.razaoSocial : (config.razao_social || ''),
            nomeFantasia: useTestData ? TECNOSPEED_TEST_DATA.razaoSocial : (config.nome_fantasia || config.razao_social || ''),
            simplesNacional: config.regime_tributario === '1',
            regimeTributario: parseInt(config.regime_tributario) || 1,
            email: config.email || 'suporte@lucrocerto.com.br',
            certificado: useTestData ? '' : (config.certificado_id || config.certificado || ''),
            telefone: {
                ddd: (config.telefone || '').replace(/\D/g, '').substring(0, 2) || '44',
                numero: (config.telefone || '').replace(/\D/g, '').substring(2) || '30379500'
            },
            endereco: useTestData ? TECNOSPEED_TEST_DATA.endereco : {
                logradouro: (config.endereco?.logradouro || config.logradouro || '').trim(),
                numero: (config.endereco?.numero || config.numero || 'SN').trim(),
                bairro: (config.endereco?.bairro || config.bairro || 'Centro').trim(),
                cep: (config.endereco?.cep || config.cep || '').replace(/\D/g, ''),
                codigoCidade: (config.endereco?.codigoCidade || config.codigo_municipio || '').trim(),
                uf: (config.endereco?.uf || config.uf || '').trim().toUpperCase(),
                complemento: (config.endereco?.complemento || config.complemento || '').trim()
            },
            nfse: {
                ativo: true,
                config: { producao: false }
            },
            nfe: {
                ativo: true,
                config: { producao: false }
            }
        };

        console.log('🚀 [FISCAL-SYNC] Enviando Payload para TecnoSpeed:', JSON.stringify({
            url: `${baseUrl}/empresa`,
            cnpj: effectiveCnpj,
            is_sandbox: isSandbox
        }, null, 2));

        let response;
        try {
            response = await axios.post(`${baseUrl}/empresa`, issuerPayload, {
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
            });
        } catch (error: any) {
            if (error.response?.status === 409) {
                // Em caso de conflito, usar o CNPJ efetivo (que pode ser o de teste) na URL do PUT
                response = await axios.put(`${baseUrl}/empresa/${effectiveCnpj}`, issuerPayload, {
                    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
                });
            } else {
                throw error;
            }
        }

        // --- PERSISTÊNCIA: Salvar configuração atualizada no Supabase ---
        if (companyId && SUPABASE_URL) {
            try {
                await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                    tecnospeed_config: config
                }, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY!,
                        'Authorization': authHeader!,
                        'Content-Type': 'application/json'
                    }
                });
                console.log('✅ Configuração fiscal persistida no Supabase após sincronização.');
            } catch (dbErr: any) {
                console.warn('⚠️ Falha ao salvar config no banco:', dbErr.message);
            }
        }

        res.json({ ...response.data, proxy_version: '1.0.10', synced_id: issuerPayload.certificado });
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ [FISCAL-SYNC] Erro na TecnoSpeed:', JSON.stringify(errorDetail, null, 2));
        
        res.status(error.response?.status || 500).json({ 
            error: error.message, 
            detail: errorDetail
        });
    }
});

app.post(['/fiscal-module/save-config', '/api/fiscal-module/save-config'], authenticate, async (req, res) => {
    const { companyId, config } = req.body;
    const authHeader = req.headers.authorization;

    if (!companyId || !config) {
        return res.status(400).json({ error: 'companyId e config são obrigatórios' });
    }

    try {
        console.log(`💾 Salvando configuração fiscal para empresa: ${companyId}`);
        await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            tecnospeed_config: config
        }, {
            headers: {
                'apikey': SUPABASE_ANON_KEY!,
                'Authorization': authHeader!,
                'Content-Type': 'application/json'
            }
        });
        res.json({ success: true, message: 'Configuração salva com sucesso.' });
    } catch (error: any) {
        console.error('❌ Erro ao salvar config:', error.response?.data || error.message);
        res.status(500).json({ error: 'Erro ao salvar configuração no banco', detail: error.response?.data });
    }
});

// Helper para resolver o nome correto da instância na Evolution API (Resiliente a Case-Sensitivity e IDs Órfãos)
async function resolveTargetName(requestedName: string, token?: string): Promise<string> {
    try {
        console.log(`🔍 Resolvendo instância: "${requestedName}" (Token: ${token || 'N/A'})`);
        const response = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        const instances = Array.isArray(response.data) ? response.data : [];

        // 1. Tentar encontrar pelo Token (ID Técnico/Evo ID)
        if (token) {
            const match = instances.find((i: any) => i.token === token || i.id === token);
            if (match) {
                const actualName = match.name || match.instanceName;
                console.log(`🎯 Resolvido via Token: ${token} -> ${actualName}`);
                return actualName;
            }
        }

        // 2. Tentar encontrar pelo Nome (Case-Insensitive)
        const nameMatch = instances.find((i: any) =>
            (i.name || i.instanceName || '').toLowerCase() === requestedName.toLowerCase()
        );

        if (nameMatch) {
            const actualName = nameMatch.name || nameMatch.instanceName;
            console.log(`🔍 Resolvido via Nome (Case-Insensitive): "${requestedName}" -> "${actualName}"`);
            return actualName;
        }

        console.warn(`⚠️ Instância não encontrada para "${requestedName}". Usando nome original.`);
        return requestedName;
    } catch (error) {
        console.error('❌ Erro ao resolver nome da instância:', error);
        return requestedName;
    }
}

app.get(['/fiscal-module/status/:id', '/api/fiscal-module/status/:id'], authenticate, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const apiKey = config.tecnospeed_api_key?.trim().toLowerCase();
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();

        const response = await axios.get(`${baseUrl}/nfe/${id}`, {
            headers: { 'X-API-KEY': apiKey }
        });

        const statusData = response.data;
        if (statusData?.data?.status && SUPABASE_URL) {
            try {
                await axios.patch(`${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${id}`, {
                    status: statusData.data.status,
                    pdf_url: statusData.data.pdf,
                    xml_url: statusData.data.xml
                }, {
                    headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader!, 'Content-Type': 'application/json' }
                });
            } catch (dbErr) { console.warn('⚠️ Falha ao atualizar status local'); }
        }
        res.json(statusData);
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao consultar status', detail: error.response?.data || error.message });
    }
});

app.get(['/fiscal-module/nfe/:id/pdf', '/api/fiscal-module/nfe/:id/pdf'], authenticate, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const apiKey = config.tecnospeed_api_key?.trim().toLowerCase();
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();

        const response = await axios.get(`${baseUrl}/nfe/${id}/pdf`, {
            headers: { 'X-API-KEY': apiKey },
            responseType: 'arraybuffer'
        });
        res.contentType('application/pdf');
        res.send(response.data);
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao baixar PDF', detail: error.response?.data || error.message });
    }
});

app.get(['/fiscal-module/nfe/:id/xml', '/api/fiscal-module/nfe/:id/xml'], authenticate, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const apiKey = config.tecnospeed_api_key?.trim().toLowerCase();
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();

        const response = await axios.get(`${baseUrl}/nfe/${id}/xml`, {
            headers: { 'X-API-KEY': apiKey }
        });
        res.contentType('application/xml');
        res.send(response.data);
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao baixar XML', detail: error.response?.data || error.message });
    }
});

// Helper para buscar configuração fiscal da empresa no Supabase
async function getCompanyFiscalConfig(authHeader: string, companyId: string) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase URL ou Anon Key não configurados no servidor.');
    }

    try {
        console.log(`🏢 Buscando config fiscal para empresa: ${companyId}`);
        const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
            params: {
                id: `eq.${companyId}`,
                select: 'tecnospeed_config,fiscal_module_enabled'
            },
            headers: {
                'apikey': SUPABASE_ANON_KEY as string,
                'Authorization': authHeader // Repassa o JWT do usuário para respeitar RLS
            }
        });

        const company = response.data?.[0];
        if (!company) throw new Error('Empresa não encontrada ou acesso negado no Supabase.');
        if (!company.fiscal_module_enabled) throw new Error('Módulo fiscal não habilitado para esta empresa.');
        if (!company.tecnospeed_config) throw new Error('Configuração da TecnoSpeed não encontrada para esta empresa. Verifique as configurações fiscais.');

        return company.tecnospeed_config;
    } catch (error: any) {
        console.error('❌ Erro ao buscar config fiscal:', error.response?.data || error.message);
        throw error;
    }
}

// Endpoints
app.post('/instances', authenticate, async (req, res) => {
    const { name, token: customToken, webhook_url, webhook_events, enabled, base64 } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Nome da instância é obrigatório' });
    }

    try {
        console.log(`🔌 Creating instance "${name}" on Evolution API...`);

        // Função para gerar ID no formato 12-4-4-12 (Total 32 hex)
        const generateEvoID = () => {
            const hex = '0123456789ABCDEF';
            const part = (len: number) => {
                let res = '';
                for (let i = 0; i < len; i++) res += hex.charAt(Math.floor(Math.random() * hex.length));
                return res;
            };
            return `${part(12)}-${part(4)}-${part(4)}-${part(12)}`;
        };

        const token = customToken || generateEvoID();

        // Configuração do Webhook
        const webhookConfig = webhook_url ? {
            enabled: enabled ?? true,
            url: webhook_url,
            webhook_by_events: false,
            webhookByEvents: false, // Compatibilidade v2
            base64: base64 ?? true,
            webhookBase64: base64 ?? true, // Compatibilidade v2
            events: webhook_events || ['MESSAGES_UPSERT']
        } : undefined;

        console.log('📤 Sending payload to Evolution:', JSON.stringify({
            instanceName: name,
            token: token,
            webhook: webhookConfig
        }, null, 2));

        // 1. Chamar Evolution API para criar
        const response = await axios.post(`${EVOLUTION_API_URL}/instance/create`, {
            instanceName: name, // O NOME amigável agora volta a ser o identificador na Evolution
            token: token,      // O ID técnico (UUID) vai como o token da instância
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
            webhook: webhookConfig
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        console.log('✅ Instance created on Evolution:', response.data);

        // 2. Retornar dados para o frontend salvar
        res.status(201).json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro na Evolution API:', errorDetail);
        res.status(500).json({
            error: 'Erro ao criar instância na Evolution API',
            detail: errorDetail
        });
    }
});

app.get('/instances/:name/connect', authenticate, async (req, res) => {
    const { name } = req.params;

    try {
        const encodedName = encodeURIComponent(name);
        console.log(`🔍 Fetching QR Code for instance "${name}"...`);
        const response = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${encodedName}`, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        console.log('✅ QR Code received');
        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro ao obter QR Code:', errorDetail);
        res.status(500).json({
            error: 'Erro ao buscar QR Code na Evolution API',
            detail: errorDetail
        });
    }
});

app.post('/instances/:name/webhook', authenticate, async (req, res) => {
    const { name } = req.params;
    const { url, events, enabled, base64, token } = req.body;

    try {
        const targetName = await resolveTargetName(name, token);
        const encodedName = encodeURIComponent(targetName);
        console.log(`📡 Updating webhook for instance "${targetName}"...`);
        // O endpoint testado com sucesso é /webhook/set/:instance com payload aninhado
        const response = await axios.post(`${EVOLUTION_API_URL}/webhook/set/${encodedName}`, {
            webhook: {
                enabled: enabled ?? true,
                url: url,
                webhook_by_events: false,
                base64: base64 ?? true,
                events: events || ['MESSAGES_UPSERT']
            }
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro ao configurar webhook:', JSON.stringify(errorDetail, null, 2));
        res.status(500).json({
            error: 'Erro ao configurar webhook na Evolution API',
            detail: typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail
        });
    }
});

app.post('/instances/:name/rename', authenticate, async (req, res) => {
    const { name } = req.params;
    const { newName } = req.body;
    const { token } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string);
        const encodedName = encodeURIComponent(targetName);
        console.log(`📝 Renaming instance "${targetName}" to "${newName}"...`);

        const response = await axios.post(`${EVOLUTION_API_URL}/instance/updateInstanceName/${encodedName}`, {
            newInstanceName: newName
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        console.log(`✅ Rename successful for "${targetName}":`, JSON.stringify(response.data, null, 2));
        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error(`❌ Erro ao renomear instância "${name}":`, JSON.stringify(errorDetail, null, 2));
        res.status(500).json({
            error: 'Erro ao renomear instância na Evolution API',
            detail: errorDetail
        });
    }
});

app.post('/instances/:name/profile-name', authenticate, async (req, res) => {
    const { name } = req.params;
    const { profileName } = req.body;
    const { token } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string);
        const encodedName = encodeURIComponent(targetName);
        console.log(`👤 Updating WhatsApp profile name for "${targetName}" to "${profileName}"...`);

        const response = await axios.post(`${EVOLUTION_API_URL}/chat/updateProfileName/${encodedName}`, {
            name: profileName,
            profileName: profileName
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        console.log(`✅ Profile name updated for "${targetName}":`, JSON.stringify(response.data, null, 2));
        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error(`❌ Erro ao atualizar nome do perfil "${name}":`, JSON.stringify(errorDetail, null, 2));
        res.status(500).json({
            error: 'Erro ao atualizar nome do perfil na Evolution API',
            detail: errorDetail
        });
    }
});



app.get('/instances/:name/details', authenticate, async (req, res) => {
    const { name } = req.params;
    const { token } = req.query;

    try {
        console.log(`🔌 Fetching details for "${name}" (Token: ${token || 'N/A'})...`);

        // Use o helper resiliente para encontrar os dados completos da instância
        const response = await axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        const allInstances = Array.isArray(response.data) ? response.data : [];

        // Match por Token ou Nome Case-Insensitive
        const match = allInstances.find((i: any) =>
            (token && (i.token === token || i.id === token)) ||
            ((i.name || i.instanceName || '').toLowerCase() === name.toLowerCase())
        );

        if (match) {
            console.log(`✅ Details found for: ${match.name || match.instanceName}`);
            return res.json(match);
        }

        throw new Error('Instance not found');
    } catch (error: any) {
        console.warn('⚠️ Detalhes não encontrados na Evolution:', error.message);
        res.status(404).json({ status: 'disconnected', error: 'Instance not found' });
    }
});



app.post('/webhook/test', authenticate, async (req, res) => {
    const { webhook_url, instance, event_type } = req.body;

    if (!webhook_url) {
        return res.status(400).json({ error: 'URL do Webhook obrigatória' });
    }

    const payload = {
        event: event_type || 'TEST_WEBHOOK',
        instance: instance.instance_name,
        data: {
            id: 'TEST-ID-' + Date.now(),
            remoteJid: '552199999999@s.whatsapp.net',
            status: 'connected',
            text: 'Isto é um teste de disparo do Lucro Certo!'
        },
        whatsapp: {
            instanceName: instance.instance_name,
            instanceId: instance.evolution_instance_id,
            status: instance.status,
            phone_number: instance.phone_number
        },
        sender: 'Lucro Certo Test Service',
        timestamp: Date.now()
    };

    try {
        console.log(`🧪 Testing webhook to ${webhook_url}...`);
        await axios.post(webhook_url, payload);
        res.json({ success: true, message: 'Disparo de teste enviado com sucesso!' });
    } catch (error: any) {
        console.error('❌ Falha no teste de webhook:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Error setup:', error.message);
        }

        res.status(502).json({
            error: 'Falha ao entregar o webhook de teste',
            details: error.message,
            full_error: error.response ? error.response.data : error.message
        });
    }
});

app.post('/instances/:name/logout', authenticate, async (req, res) => {
    const { name } = req.params;
    const { token } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string);
        console.log(`🔌 Logging out instance "${targetName}"...`);

        // Evolution API is inconsistent: some versions use POST, others DELETE.
        let logoutSuccess = false;
        let lastError: any = null;

        try {
            const encodedName = encodeURIComponent(targetName);
            console.log(`📡 Trying DELETE /instance/logout/${targetName}...`);
            await axios.delete(`${EVOLUTION_API_URL}/instance/logout/${encodedName}`, {
                headers: { 'apikey': EVOLUTION_API_KEY }
            });
            console.log(`✅ Logout (DELETE) bem sucedido para "${targetName}"`);
            logoutSuccess = true;
        } catch (delErr: any) {
            lastError = delErr;
            const status = delErr.response?.status;
            console.warn(`⚠️ DELETE Logout falhou (${status}). Tentando POST...`);
            if (status === 404 || status === 403 || status === 400) {
                console.log(`ℹ️ Instância já parece estar deslogada ou não encontrada no DELETE (${status}).`);
                logoutSuccess = true;
            }
        }

        if (!logoutSuccess) {
            try {
                const encodedName = encodeURIComponent(targetName);
                console.log(`📡 Trying POST /instance/logout/${targetName}...`);
                await axios.post(`${EVOLUTION_API_URL}/instance/logout/${encodedName}`, {}, {
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                console.log(`✅ Logout (POST) bem sucedido para "${targetName}"`);
                logoutSuccess = true;
            } catch (postErr: any) {
                lastError = postErr;
                const status = postErr.response?.status;
                if (status === 404 || status === 403 || status === 400) {
                    console.log(`ℹ️ Instância já parece estar deslogada ou não encontrada no POST (${status}).`);
                    logoutSuccess = true;
                }
            }
        }

        if (!logoutSuccess) throw lastError;

        res.json({ success: true, message: 'Instância desconectada com sucesso' });
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        const status = error.response?.status || 500;
        console.error(`❌ Erro técnico ao deslogar "${name}":`, JSON.stringify(errorDetail, null, 2));
        res.status(status).json({
            error: 'Erro ao deslogar na Evolution API',
            detail: errorDetail
        });
    }
});

app.delete('/instances/:name', authenticate, async (req, res) => {
    const { name } = req.params;
    const { token } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string);
        const encodedName = encodeURIComponent(targetName);
        console.log(`🗑️ Deleting instance "${targetName}"...`);

        const response = await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${encodedName}`, {
            headers: {
                'apikey': EVOLUTION_API_KEY
            }
        });

        console.log(`✅ Delete successful for "${targetName}"`);
        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.warn(`❌ Erro ao deletar "${name}" na Evolution:`, JSON.stringify(errorDetail, null, 2));
        res.json({ success: true, warning: 'Falha ou não encontrada na Evolution, mas prosseguindo.' });
    }
});




// --- PAYMENT GATEWAY ROUTES ---

app.post('/payments/create', authenticate, async (req, res) => {
    const { companyId, provider, config, payload, is_sandbox, customerId, quoteId } = req.body;

    try {
        console.log(`💳 Gerando cobrança ${provider.toUpperCase()} para empresa ${companyId}...${quoteId ? ` (Ref. Orçamento: ${quoteId})` : ''}`);

        // 1. Gerar referência externa se não existir
        const external_reference = payload.external_reference || `CHG-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;

        const adapter = PaymentFactory.getAdapter(provider, config, is_sandbox ?? true);
        const result = await adapter.createCharge({
            ...payload,
            external_reference,
            notification_url: `${process.env.PUBLIC_URL || 'https://seu-servidor.com'}/payments/webhook/${provider}/${companyId}`
        });

        if (result.success) {
            // 2. Salvar na tabela company_charges
            await axios.post(`${SUPABASE_URL}/rest/v1/company_charges`, {
                company_id: companyId,
                customer_id: customerId,
                quote_id: quoteId, // Persistir vínculo com orçamento
                provider,
                amount: payload.amount,
                description: payload.description,
                external_reference,
                payment_method: payload.payment_method || 'pix',
                status: result.status,
                gateway_id: result.payment_id,
                payment_link: result.payment_link,
                qr_code: result.qr_code,
                qr_code_base64: result.qr_code_base64,
                is_sandbox: is_sandbox ?? true
            }, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY as string,
                    'Authorization': (req.headers.authorization || '') as string,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                }
            });
        }

        res.json(result);
    } catch (error: any) {
        console.error('❌ Erro ao criar pagamento:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/payments/process-checkout', async (req, res) => {
    const { chargeId, provider, method } = req.body;

    try {
        console.log(`🛒 Processando Checkout para cobrança ${chargeId} com provedor ${provider}`);

        // 1. Get Charge details (Publicly accessible but read-only for specific ID)
        const chargeResponse = await axios.get(`${SUPABASE_URL}/rest/v1/company_charges?id=eq.${chargeId}&select=*,company:companies(name)`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });

        const charge = chargeResponse.data?.[0];
        if (!charge) return res.status(404).json({ error: 'Cobrança não encontrada.' });

        // 2. Get Gateway Config
        const gatewayResponse = await axios.get(`${SUPABASE_URL}/rest/v1/company_payment_gateways?company_id=eq.${charge.company_id}&provider=eq.${provider}&is_active=eq.true&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });

        const gateway = gatewayResponse.data?.[0];
        if (!gateway) return res.status(400).json({ error: `O provedor ${provider} não está disponível para esta empresa.` });

        // 3. Setup Adapter and Create Real Charge
        const adapter = PaymentFactory.getAdapter(provider, gateway.config, gateway.is_sandbox);

        // Fetch customer details if they are linked to the charge (Need to fetch from contacts via internal API)
        // For simplicity in this demo/MVP, we'll try to get customer name/email from the charge or a fallback
        // Ideally, company_charges should have customer_name/email or we fetch from contacts
        const contactResponse = await axios.get(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${charge.customer_id}&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        const contact = contactResponse.data?.[0];

        const result = await adapter.createCharge({
            amount: charge.amount,
            description: charge.description,
            external_reference: charge.external_reference,
            customer: {
                name: contact?.name || 'Cliente Vinx',
                email: contact?.email || 'financeiro@vinx.com.br',
                tax_id: contact?.tax_id || undefined
            },
            payment_method: method,
            notification_url: `${process.env.PUBLIC_URL || 'https://api.vinx.com.br'}/payments/webhook/${provider}/${charge.company_id}`
        });

        if (result.success) {
            // Update charge with the specific gateway ID and link
            await axios.patch(`${SUPABASE_URL}/rest/v1/company_charges?id=eq.${chargeId}`, {
                gateway_id: result.payment_id,
                payment_link: result.payment_link,
                qr_code: result.qr_code,
                qr_code_base64: result.qr_code_base64,
                status: result.status
            }, {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Content-Type': 'application/json'
                }
            });
        }

        res.json(result);
    } catch (error: any) {
        console.error('❌ Erro no Processo de Checkout:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/payments/webhook/:provider/:companyId', async (req, res) => {
    const { provider, companyId } = req.params;
    const notification = req.body;

    try {
        console.log(`🔔 Webhook recebido (${provider}) para empresa ${companyId}`);

        // 1. Buscar configuração da empresa no Supabase
        const responseSupabase = await axios.get(`${SUPABASE_URL}/rest/v1/company_payment_gateways?company_id=eq.${companyId}&provider=eq.${provider}&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });

        let gatewayConfig = responseSupabase.data?.[0];
        let config: any = null;
        let is_sandbox = true;

        if (gatewayConfig) {
            config = gatewayConfig.config;
            is_sandbox = gatewayConfig.is_sandbox ?? true;
        } else {
            // FALLBACK: Se não achar na tabela de gateways da empresa, verificar se é uma configuração global do sistema (Platform Billing)
            console.log(`🔍 Gateway não encontrado para empresa ${companyId}. Verificando app_settings...`);
            const { data: appSettings } = await axios.get(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=*`, {
                headers: { 'apikey': SUPABASE_ANON_KEY }
            });

            const settings = appSettings?.[0];
            if (settings && settings.platform_billing_provider === provider) {
                console.log('✅ Usando configurações globais de faturamento da plataforma.');
                const isSandbox = settings.platform_billing_sandbox !== false;
                const env = isSandbox ? 'sandbox' : 'production';
                const configData = settings.platform_billing_config?.[provider]?.[env] || {};

                if (provider === 'asaas') config = { api_key: configData.api_key };
                else if (provider === 'stripe') config = { secret_key: configData.secret_key };
                else if (provider === 'mercadopago') config = { access_token: configData.access_token };
            }
        }

        if (!config) {
            throw new Error(`Configuração de gateway não encontrada para o provedor ${provider}`);
        }

        const adapter = PaymentFactory.getAdapter(provider, config, is_sandbox);
        const { external_reference, status } = await adapter.handleNotification(notification);

        console.log(`✅ Pagamento ${external_reference} atualizado para: ${status}`);

        // 2. Atualizar o registro na tabela company_charges
        const updateChargeResponse = await axios.patch(`${SUPABASE_URL}/rest/v1/company_charges?external_reference=eq.${external_reference}&select=quote_id,description,amount`, {
            status: status,
            paid_at: status === 'approved' ? new Date().toISOString() : null
        }, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        const chargeData = updateChargeResponse.data?.[0];

        // 3. LÓGICA DE NEGÓCIO PÓS-PAGAMENTO
        if (status === 'approved' && chargeData) {
            // A) Sincronizar com Orçamento e Transação Financeira (se houver quote_id)
            if (chargeData.quote_id) {
                console.log(`🔗 Sincronizando aprovação com Orçamento: ${chargeData.quote_id}`);

                await axios.patch(`${SUPABASE_URL}/rest/v1/quotes?id=eq.${chargeData.quote_id}`, {
                    payment_status: 'paid'
                }, { headers: { 'apikey': SUPABASE_ANON_KEY } });

                await axios.patch(`${SUPABASE_URL}/rest/v1/transactions?quote_id=eq.${chargeData.quote_id}`, {
                    status: 'received',
                    payment_date: new Date().toISOString().split('T')[0]
                }, { headers: { 'apikey': SUPABASE_ANON_KEY } });
            }

            // B) Sincronizar com Assinatura da Plataforma (se a cobrança for do plano "Lucro Certo")
            // Identificamos isso pela descrição ou se for uma cobrança sem quote_id gerada pelo Admin
            if (chargeData.description?.toLowerCase().includes('lucro certo') || chargeData.description?.toLowerCase().includes('assinatura')) {
                console.log('⭐ Pagamento de Assinatura Detectado. Atualizando status da empresa...');

                // Buscar empresa pelo nome contido na descrição (fallback simples do MVP)
                // O ideal seria ter target_company_id na tabela company_charges
                const possibleCompanyName = chargeData.description.split('-').pop()?.trim();

                if (possibleCompanyName) {
                    const { data: companies } = await axios.get(`${SUPABASE_URL}/rest/v1/companies?trade_name=ilike.%${possibleCompanyName}%&select=id`, {
                        headers: { 'apikey': SUPABASE_ANON_KEY }
                    });

                    if (companies && companies[0]) {
                        await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companies[0].id}`, {
                            subscription_status: 'active',
                            subscription_plan: 'pro',
                            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 dias
                        }, { headers: { 'apikey': SUPABASE_ANON_KEY } });
                        console.log(`✅ Assinatura da empresa ${possibleCompanyName} renovada!`);
                    }
                }
            }
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('❌ Erro no Webhook:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/payments/test-connection', authenticate, async (req, res) => {
    const { provider, config, is_sandbox } = req.body;

    try {
        console.log(`🔌 Testando conexão ${provider.toUpperCase()} (Sandbox: ${is_sandbox})...`);
        const adapter = PaymentFactory.getAdapter(provider, config, is_sandbox ?? true);
        const result = await adapter.testConnection();
        res.json(result);
    } catch (error: any) {
        console.error('❌ Erro ao testar conexão:', error.message);
        res.status(400).json({ success: false, message: error.message });
    }
});

app.post('/payments/asaas/create-key', authenticate, async (req, res) => {
    const { config, is_sandbox } = req.body;

    try {
        const { AsaasAdapter } = await import('./services/payments/adapters/AsaasAdapter.js');
        const adapter = new AsaasAdapter(config, is_sandbox ?? true);
        const result = await adapter.createRandomPixKey();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/payments/cron/check-subscriptions', async (req, res) => {
    try {
        console.log('⏰ Iniciando verificação de assinaturas...');

        // 1. Buscar configurações globais
        const { data: appSettings } = await axios.get(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });
        const settings = appSettings?.[0];

        if (!settings || !settings.billing_notifications_enabled) {
            return res.json({ message: 'Notificações de faturamento desativadas globalmente.' });
        }

        const daysBefore = settings.billing_days_before_reminder || [5, 2, 0];
        const whatsappInstance = settings.platform_whatsapp_instance;
        const waTemplate = settings.billing_whatsapp_template;

        if (!whatsappInstance || !waTemplate) {
            return res.json({ message: 'Configurações de WhatsApp (instância ou template) ausentes.' });
        }

        // 2. Buscar empresas ativas
        const { data: companies } = await axios.get(`${SUPABASE_URL}/rest/v1/companies?status=eq.active&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });

        if (!companies) return res.json({ message: 'Nenhuma empresa encontrada.' });

        let notificationsSent = 0;

        for (const company of companies) {
            const targetDateStr = company.subscription_plan === 'trial' ? company.trial_ends_at : company.current_period_end;
            if (!targetDateStr) continue;

            const targetDate = new Date(targetDateStr);
            const today = new Date();
            const diffTime = targetDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Verificar se o dia atual está na régua de cobrança
            if (daysBefore.includes(diffDays)) {
                console.log(`📢 Notificando ${company.trade_name} - Faltam ${diffDays} dias.`);

                // Buscar cobrança pendente para gerar o link
                const { data: charges } = await axios.get(`${SUPABASE_URL}/rest/v1/company_charges?status=eq.pending&description=ilike.%${company.trade_name}%&order=created_at.desc&limit=1`, {
                    headers: { 'apikey': SUPABASE_ANON_KEY }
                });

                const charge = charges?.[0];
                const paymentLink = charge ? (charge.payment_link || `${process.env.PUBLIC_URL || 'https://lucrocerto.com'}/pay/${charge.id}`) : 'Link não disponível (contate suporte)';

                // Formatar mensagem
                const message = waTemplate
                    .replace('{company_name}', company.trade_name)
                    .replace('{days}', diffDays.toString())
                    .replace('{due_date}', targetDate.toLocaleDateString('pt-BR'))
                    .replace('{value}', new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(company.next_billing_value || 97))
                    .replace('{payment_link}', paymentLink);

                // Enviar via Evolution API
                if (company.owner_phone || company.phone) {
                    const phone = (company.owner_phone || company.phone).replace(/\D/g, '');
                    try {
                        const encodedInstance = encodeURIComponent(whatsappInstance);
                        await axios.post(`${EVOLUTION_API_URL}/message/sendText/${encodedInstance}`, {
                            number: phone,
                            text: message
                        }, {
                            headers: { 'apikey': EVOLUTION_API_KEY }
                        });
                        notificationsSent++;
                    } catch (err: any) {
                        console.error(`❌ Erro ao enviar WA para ${company.trade_name}:`, err.message);
                    }
                }
            }
        }

        res.json({ success: true, notifications_sent: notificationsSent });
    } catch (error: any) {
        console.error('❌ Erro no Cron de Assinaturas:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/whatsapp/send', authenticate, async (req, res) => {
    const { instanceName, number, text } = req.body;

    if (!instanceName || !number || !text) {
        return res.status(400).json({ error: 'instanceName, number e text são obrigatórios' });
    }

    try {
        const targetName = await resolveTargetName(instanceName);
        const encodedName = encodeURIComponent(targetName);
        console.log(`✉️ Enviando mensagem WhatsApp via "${targetName}" para ${number}...`);

        const response = await axios.post(`${EVOLUTION_API_URL}/message/sendText/${encodedName}`, {
            number: number,
            text: text,
            linkPreview: true
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro ao enviar WhatsApp:', JSON.stringify(errorDetail, null, 2));
        res.status(500).json({ error: 'Erro ao enviar mensagem via Evolution API', detail: errorDetail });
    }
});

// --- FINAL HANDLERS ---

// Rota de fallback para 404 - Retorna JSON em vez do HTML padrão do Express
app.use((req, res) => {
    console.warn(`[Proxy] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({
        error: 'Rota não encontrada no servidor proxy',
        method: req.method,
        path: req.url
    });
});

// Tratamento global de erros - Retorna JSON em vez do HTML padrão do Express
app.use((err: any, req: any, res: any, next: any) => {
    console.error('[Proxy] Internal Server Error:', err);
    res.status(err.status || 500).json({
        error: 'Erro interno no servidor proxy',
        message: err.message,
        detail: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
});

// No local, escutamos na porta definida (3001 por padrão)
// Em produção (Vercel), o app é exportado e gerenciado pelo serviço.
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 [Proxy Server] Rodando em http://localhost:${PORT}`);
    });
}

export default app;
