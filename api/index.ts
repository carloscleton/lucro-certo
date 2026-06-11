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

// Normalizar prefixo /api em produção/Vercel
app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
        req.url = req.url.substring(4);
        if (req.url === '') req.url = '/';
    }
    next();
});

// Roteamento robusto: todas as rotas fiscais suportam prefixo /api ou direto.

// Evolution API Config
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY?.trim();

// Supabase Config for Fiscal Proxy
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

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

// Proxy para cotações de moedas com fallback robusto contra falhas de CORS/Rede
app.get(['/exchange-rates', '/api/exchange-rates'], async (req, res) => {
    try {
        // 1. Tenta a AwesomeAPI com timeout curto (5s)
        const response = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,PYG-BRL,ARS-BRL', {
            timeout: 5000
        });
        return res.json(response.data);
    } catch (awesomeError: any) {
        console.warn('⚠️ [Exchange Rates Proxy] Falha ao consultar AwesomeAPI, usando fallback do ExchangeRate-API:', awesomeError.message);
        
        try {
            // 2. Fallback para ExchangeRate-API
            const fallbackResponse = await axios.get('https://open.er-api.com/v6/latest/BRL', {
                timeout: 5000
            });
            
            const rates = fallbackResponse.data.rates;
            if (!rates) {
                throw new Error('Rates not found in fallback response');
            }
            
            const mockAwesomeData = {
                USDBRL: {
                    bid: rates.USD ? (1 / rates.USD).toFixed(4) : "5.0000",
                    pctChange: "0.00"
                },
                EURBRL: {
                    bid: rates.EUR ? (1 / rates.EUR).toFixed(4) : "5.4000",
                    pctChange: "0.00"
                },
                PYGBRL: {
                    bid: rates.PYG ? (1 / rates.PYG).toFixed(6) : "0.000800",
                    pctChange: "0.00"
                },
                ARSBRL: {
                    bid: rates.ARS ? (1 / rates.ARS).toFixed(6) : "0.005800",
                    pctChange: "0.00"
                }
            };
            return res.json(mockAwesomeData);
        } catch (fallbackError: any) {
            console.error('❌ [Exchange Rates Proxy] Falha no fallback também:', fallbackError.message);
            
            // 3. Fallback absoluto usando taxas estáticas seguras
            const absoluteFallback = {
                USDBRL: { bid: "5.0000", pctChange: "0.00" },
                EURBRL: { bid: "5.4000", pctChange: "0.00" },
                PYGBRL: { bid: "0.000800", pctChange: "0.00" },
                ARSBRL: { bid: "0.005800", pctChange: "0.00" }
            };
            return res.json(absoluteFallback);
        }
    }
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
    return s.trim();
};

// --- BLOCO FISCAL ---
// Movidos para o topo para garantir prioridade e depuração

app.get(['/fiscal-module/health', '/api/fiscal-module/health'], (req, res) => {
    res.json({ status: 'ok', service: 'fiscal-proxy', timestamp: new Date(), version: '1.0.31' });
});

app.post(['/fiscal-module/cancelar', '/api/fiscal-module/cancelar'], authenticate, async (req, res) => {
    let { id, type, companyId, justificativa } = req.body;
    const authHeader = req.headers.authorization;

    try {
        const { config, settings } = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const activeProvider = settings?.fiscal_provider || 'tecnospeed';
        const apiKey = config.tecnospeed_api_key?.trim().toLowerCase();
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();
        
        // --- SANITIZAÇÃO DA URL BASE ---
        let cleanBaseUrl = baseUrl.replace(/\/$/, '').replace(/\/(nfse|nfe)$/i, '');
        
        // --- PROTEÇÃO DE ID ---
        if (id && !isNaN(Number(id))) {
            try {
                const { data: invData } = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                    params: { id: `eq.${id}`, select: 'external_id,type' },
                    headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader! }
                });
                if (invData?.[0]?.external_id) {
                    id = invData[0].external_id;
                    if (!type) type = invData[0].type;
                }
            } catch (dbErr) {
                console.warn('⚠️ Falha ao buscar external_id:', id);
            }
        }

        // --- ROTEAMENTO NFE.IO ---
        if (type === 'nfeio' || activeProvider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta para cancelamento.' });
            }

            const apiKeyNfe = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            console.log(`🚫 [NFEIO-CANCELAR] Cancelando nota NFe.io ID: ${id}`);
            
            const response = await axios.delete(`https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}`, {
                headers: {
                    'Authorization': apiKeyNfe
                }
            });

            // Atualizar status no Supabase
            if (SUPABASE_URL) {
                try {
                    await axios.patch(`${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${id}`, {
                        status: 'cancelado',
                        cancellation_reason: justificativa,
                        updated_at: new Date().toISOString()
                    }, {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY!,
                            'Authorization': authHeader!,
                            'Content-Type': 'application/json'
                        }
                    });
                } catch (dbErr: any) {
                    console.warn('⚠️ Falha ao atualizar status de cancelamento NFe.io no banco:', dbErr.message);
                }
            }

            return res.json({ success: true, ...response.data });
        }
        
        if (!type || (type !== 'nfe' && type !== 'nfse')) {
            try {
                const { data: invData } = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                    params: { external_id: `eq.${id}`, select: 'type' },
                    headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader! }
                });
                if (invData?.[0]?.type) type = invData[0].type;
                else type = 'nfse';
            } catch (dbErr) { type = 'nfse'; }
        }

        const typeLower = type.toLowerCase();
        let lastError = null;

        // --- ESTRATÉGIA BRUTE FORCE DISCOVERY (v1.0.25) ---
        if (typeLower === 'nfse' || typeLower === 'nfsenac') {
            // 1. Padrão Nacional Oficial (Documentação)
            try {
                const targetUrl = `${cleanBaseUrl}/nfse/cancelar/${id}`;
                const response = await axios.post(targetUrl, { 
                    codigo: '9', // Outros
                    motivo: justificativa || 'Cancelamento solicitado pelo usuario'
                }, {
                    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
                });
                return finalizeCancel(id, response.data);
            } catch (error: any) {
                lastError = error;
                if (error.response?.status !== 404 && !JSON.stringify(error.response?.data).includes('não existe')) throw error;
            }

            // 2. Padrão Nacional Simplificado
            try {
                const targetUrl = `${cleanBaseUrl}/nfse/cancelar`;
                const response = await axios.post(targetUrl, { id, justificativa: justificativa || 'Cancelamento solicitado pelo usuario' }, {
                    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
                });
                return finalizeCancel(id, response.data);
            } catch (error: any) {
                lastError = error;
                if (error.response?.status !== 404 && !JSON.stringify(error.response?.data).includes('não existe')) throw error;
            }

            // 3. Padrão Nacional Oficial Novo (nfse/nacional/:id/cancelar)
            try {
                const targetUrl = `${cleanBaseUrl}/nfse/nacional/${id}/cancelar`;
                const response = await axios.post(targetUrl, { 
                    justificativa: justificativa || 'Cancelamento solicitado pelo usuario'
                }, {
                    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
                });
                return finalizeCancel(id, response.data);
            } catch (error: any) {
                lastError = error;
                if (error.response?.status !== 404 && !JSON.stringify(error.response?.data).includes('não existe')) throw error;
            }
        }

        // 4. Padrão Municipal / Padrão NFe
        try {
            const targetUrl = `${cleanBaseUrl}/${typeLower === 'nfsenac' ? 'nfse' : typeLower}/${id}/cancelar`;
            const response = await axios.post(targetUrl, { justificativa: justificativa || 'Cancelamento solicitado pelo usuario' }, {
                headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
            });
            return finalizeCancel(id, response.data);
        } catch (error: any) {
            throw lastError || error;
        }

        async function finalizeCancel(extId: string, result: any) {
            if (SUPABASE_URL) {
                try {
                    await axios.patch(`${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${extId}`, {
                        status: 'cancelado',
                        updated_at: new Date().toISOString()
                    }, {
                        headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader!, 'Content-Type': 'application/json' }
                    });
                } catch (dbErr) { console.warn('⚠️ Falha no patch local'); }
            }
            res.json(result);
        }
    } catch (error: any) {
        const detail = error.response?.data || error.message;
        const targetUrl = error.config?.url || 'URL não capturada';
        
        console.error('❌ [FISCAL-CANCEL] Erro Detalhado:', JSON.stringify(detail));
        console.error('📍 URL tentada:', targetUrl);

        res.status(500).json({ 
            error: 'Erro ao cancelar nota', 
            detail: detail,
            attemptedUrl: targetUrl,
            version: '1.0.21'
        });
    }
});

app.post(['/fiscal-module/upload-certificate', '/api/fiscal-module/upload-certificate'], authenticate, upload.single('arquivo'), async (req: any, res) => {
    const { companyId, senha } = req.body;
    const authHeader = req.headers.authorization;
    const file = req.file;
    if (!companyId || !file || !senha) {
        return res.status(400).json({ error: 'companyId, arquivo e senha são obrigatórios' });
    }

    let baseUrl = '';
    let apiKey = '';
    let form: any = null;

    try {
        // Usar config enviada pelo frontend ou buscar no banco se não houver
        const bodyConfig = req.body.config ? (typeof req.body.config === 'string' ? JSON.parse(req.body.config) : req.body.config) : null;
        const { config: dbConfig, realCompanyId: resolvedId, settings } = await getCompanyFiscalConfig(authHeader!, companyId);
        const config = bodyConfig || dbConfig;
        const activeProvider = settings?.fiscal_provider || 'tecnospeed';

        // --- ROTEAMENTO NFE.IO ---
        if (activeProvider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta para upload de certificado.' });
            }

            apiKey = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();
            baseUrl = `https://api.nfse.io/v2/companies/${companyIdNfe}/certificates`;

            console.log(`🔐 [NFEIO-CERTIFICADO] Enviando certificado para NFe.io Empresa: ${companyIdNfe}`);

            form = new FormData();
            form.append('File', file.buffer, {
                filename: file.originalname || 'certificado.pfx',
                contentType: file.mimetype
            });
            form.append('Password', String(senha));

            const response = await axios.post(baseUrl, form, {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': apiKey
                },
                timeout: 30000
            });

            const certData = response.data;
            const certId = certData?.id || certData?.certificateId || 'nfeio_cert';
            const vencimento = certData?.validUntil || certData?.vencimento || certData?.expirationDate || certData?.endDate || new Date(Date.now() + 365*24*60*60*1000).toISOString();
            const sujeito = certData?.subject || certData?.sujeito || certData?.commonName || certData?.nome || 'Certificado NFe.io';

            if (SUPABASE_URL) {
                try {
                    const currentConfig = dbConfig || {};
                    const updatedConfig = {
                        ...currentConfig,
                        certificado_id: certId,
                        certificado_vencimento: vencimento,
                        certificado_sujeito: sujeito,
                        certificado_status: 'ativo',
                        ultima_atualizacao: new Date().toISOString()
                    };

                    await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                        tecnospeed_config: updatedConfig
                    }, {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY!,
                            'Authorization': authHeader!,
                            'Content-Type': 'application/json'
                        }
                    });

                    fiscalConfigCache.delete(companyId);
                    console.log(`✅ Certificado NFe.io (${certId}) e metadados salvos localmente.`);
                } catch (dbErr: any) {
                    console.warn('⚠️ Não foi possível salvar metadados do certificado NFe.io localmente:', dbErr.message);
                }
            }

            return res.json({
                message: 'Certificado processado com sucesso na NFe.io',
                id: certId,
                vencimento: vencimento,
                sujeito: sujeito,
                status: 'ativo'
            });
        }

        // --- INTERCEPTOR DE WEBHOOK EXTERNO PARA CERTIFICADO ---
        if (config.use_external_webhook && config.external_webhook_url) {
            console.log(`🚀 [EXTERNAL-MODE] Enviando certificado para o webhook externo: ${config.external_webhook_url}`);
            
            baseUrl = config.external_webhook_url;
            apiKey = config.external_webhook_token || '';

            const headers: any = { 
                'X-Source': 'LucroCerto-Fiscal-Proxy',
                'X-Company-ID': companyId
            };

            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            form = new FormData();
            form.append('arquivo', file.buffer, {
                filename: file.originalname || 'certificado.pfx'
            });
            form.append('senha', String(senha));
            form.append('company_id', companyId);
            form.append('action', 'upload_certificate');

            let externalCertId = 'ext_' + Math.random().toString(36).substring(2, 10);
            let externalVencimento = new Date(Date.now() + 365*24*60*60*1000).toISOString();
            let externalSujeito = 'Certificado Vinculado via Webhook Externo';

            try {
                const response = await axios.post(baseUrl, form, {
                    headers: {
                        ...form.getHeaders(),
                        ...headers
                    },
                    timeout: 30000
                });
                
                console.log(`✅ [EXTERNAL-MODE] Certificado enviado com sucesso para o webhook externo.`);
                const resData = response.data?.data || response.data;
                if (resData?.id) externalCertId = resData.id;
                if (resData?.vencimento) externalVencimento = resData.vencimento;
                if (resData?.sujeito || resData?.nome) externalSujeito = resData.sujeito || resData.nome;
            } catch (webhookErr: any) {
                console.warn(`⚠️ [EXTERNAL-MODE] Webhook externo retornou erro ou não pôde processar o arquivo diretamente:`, webhookErr.message);
                // Salvamos localmente mesmo se o webhook der erro para não travar o fluxo do Lucro Certo
            }

            // SALVAR NO BANCO DE DADOS LOCAL (JSONB na tabela companies)
            if (SUPABASE_URL) {
                try {
                    const currentConfig = config || {};
                    const updatedConfig = {
                        ...currentConfig,
                        certificado_id: externalCertId,
                        certificado_vencimento: externalVencimento,
                        certificado_sujeito: externalSujeito,
                        certificado_status: 'ativo',
                        ultima_atualizacao: new Date().toISOString()
                    };

                    await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                        tecnospeed_config: updatedConfig
                    }, {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY!,
                            'Authorization': authHeader!,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    // Invalida o cache local imediatamente
                    fiscalConfigCache.delete(companyId);
                    
                    console.log(`✅ Certificado Externo (${externalCertId}) e metadados salvos no JSONB.`);
                } catch (dbErr: any) {
                    console.warn('⚠️ Não foi possível salvar metadados no banco local:', dbErr.message);
                }
            }

            return res.json({
                message: 'Certificado processado via Webhook Externo com sucesso',
                id: externalCertId,
                vencimento: externalVencimento,
                sujeito: externalSujeito,
                status: 'ativo'
            });
        }

        apiKey = sanitizeKey(config.tecnospeed_api_key);
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase().replace(/\/$/, '');

        console.log(`🔐 DEBUG: Usando API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
        console.log(`🔐 DEBUG: Enviando para: ${baseUrl}`);

        form = new FormData();
        
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
                url: baseUrl || 'URL não definida',
                method: 'POST',
                headers_sent: form ? Object.keys(form.getHeaders()) : [],
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
        const { config, realCompanyId: resolvedId } = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const apiKey = config.tecnospeed_api_key?.trim().toLowerCase();
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase().replace(/\/$/, '');

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
    const { companyId, payload, type, quoteId, isLabTest, provider } = req.body;
    const authHeader = req.headers.authorization;

    if (!companyId || !payload) {
        return res.status(400).json({ error: 'companyId e payload são obrigatórios' });
    }

    try {
        const { config, realCompanyId: resolvedId, settings } = await getCompanyFiscalConfig(authHeader!, companyId);
        if (!config) {
            return res.status(400).json({ error: 'Configuração fiscal não encontrada.' });
        }

        const activeProvider = isLabTest ? (provider || settings?.fiscal_provider || 'tecnospeed') : (settings?.fiscal_provider || 'tecnospeed');
        
        if (activeProvider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta (Chave de API ou ID da Empresa ausente).' });
            }

            const isSandbox = nfeioConfig.ambiente === 'homologacao';
            const apiKey = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            const firstItem = Array.isArray(payload) ? payload[0] : payload;
            const taxNumber = String(firstItem?.tomador?.cpfCnpj || '').replace(/\D/g, '');
            const borrowerType = taxNumber.length === 11 ? 'NaturalPerson' : (taxNumber.length === 14 ? 'LegalEntity' : 'Undefined');

            // Mapeamento de endereço do tomador
            const tomadorEnd = firstItem?.tomador?.endereco || {};
            
            const serviceItem = Array.isArray(firstItem?.servico) ? firstItem?.servico[0] : firstItem?.servico;
            
            const nfeioPayload = {
                cityServiceCode: String(nfeioConfig.cityServiceCode || serviceItem?.codigo || nfeioConfig.cnae || '1.01').trim(),
                description: String(serviceItem?.discriminacao || serviceItem?.descricao || 'Prestação de serviço').trim(),
                servicesAmount: Number(serviceItem?.valor?.servico || serviceItem?.valorUnitario || 0),
                environmentType: isSandbox ? 'test' : 'production',
                borrower: {
                    type: borrowerType,
                    federalTaxNumber: taxNumber || '0',
                    name: String(firstItem?.tomador?.razaoSocial || firstItem?.tomador?.nomeFantasia || 'CLIENTE NAO IDENTIFICADO').trim(),
                    email: firstItem?.tomador?.email || null,
                    address: {
                        country: 'BRA',
                        postalCode: String(tomadorEnd.cep || '').replace(/\D/g, ''),
                        street: String(tomadorEnd.logradouro || '').trim(),
                        number: String(tomadorEnd.numero || '').trim(),
                        district: String(tomadorEnd.bairro || '').trim(),
                        state: String(tomadorEnd.uf || '').trim().toUpperCase(),
                        city: {
                            code: String(tomadorEnd.codigoCidade || '').trim(),
                            name: String(tomadorEnd.cidade || '').trim()
                        }
                    }
                }
            };

            console.log(`🧾 [NFEIO-EMITIR] Enviando Payload para NFe.io (Sandbox: ${isSandbox}):`, JSON.stringify(nfeioPayload, null, 2));

            const response = await axios.post(`https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices`, nfeioPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': apiKey
                }
            });

            const docId = response.data?.id;
            const status = response.data?.status || response.data?.flowStatus || 'Created';
            
            if (docId && SUPABASE_URL) {
                console.log(`💾 [DB-SAVE] Salvando nota NFe.io ${docId} para empresa ${resolvedId}`);
                try {
                    const mappedStatus = String(status).toLowerCase() === 'issued' ? 'concluido' : (String(status).toLowerCase() === 'error' ? 'erro' : 'processando');
                    
                    const getValidDocUrl = (docType: 'pdf' | 'xml') => {
                        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                        const host = req.get('host');
                        const baseApiUrl = `${protocol}://${host}`;
                        return `${baseApiUrl}/api/fiscal-module/nfeio/${docId}/${docType}?companyId=${companyId}`;
                    };

                    const pdfUrl = getValidDocUrl('pdf');
                    const xmlUrl = getValidDocUrl('xml');

                    await axios.post(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                        company_id: resolvedId,
                        quote_id: quoteId || null,
                        external_id: docId,
                        type: 'nfeio',
                        status: mappedStatus,
                        pdf_url: pdfUrl,
                        xml_url: xmlUrl,
                        payload: {
                            ...nfeioPayload,
                            retorno: response.data
                        }
                    }, {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY!,
                            'Authorization': authHeader!,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        }
                    });
                } catch (dbErr: any) {
                    console.error('❌ [DB-SAVE] Erro ao salvar nota NFe.io no banco:', dbErr.message);
                }
            }

            return res.json({ ...response.data, proxy_version: '1.0.35_nfeio', mode: 'nfeio' });
        }

        // --- MODO EXCLUSIVO: WEBHOOK EXTERNO (JSON RELAY) ---
        if (config.use_external_webhook && config.external_webhook_url) {
            console.log(`🚀 [EXTERNAL-MODE] Enviando payload RAW APENAS para: ${config.external_webhook_url}`);
            
            const headers: any = { 
                'Content-Type': 'application/json', 
                'X-Source': 'LucroCerto-Fiscal-Proxy',
                'X-Company-ID': companyId
            };

            if (config.external_webhook_token) {
                headers['Authorization'] = `Bearer ${config.external_webhook_token}`;
            }

            // Envia o payload exatamente como veio do frontend (RAW), sem injeções da TecnoSpeed
            const rawPayload = Array.isArray(payload) ? payload : [payload];
            try {
                const response = await axios.post(config.external_webhook_url, rawPayload, {
                    headers,
                    timeout: 10000
                });
                console.log(`✅ [EXTERNAL-MODE] Resposta recebida do webhook externo.`);
                return res.json({ ...response.data, proxy_version: '1.0.34', mode: 'external_relay' });
            } catch (webhookErr: any) {
                console.error(`❌ [EXTERNAL-MODE] Webhook externo retornou erro:`, webhookErr.message);
                return res.status(webhookErr.response?.status || 500).json({ 
                    error: '[ERRO DO SEU WEBHOOK N8N] O N8N tentou processar a nota, mas retornou este erro para nós.', 
                    detail: webhookErr.response?.data || webhookErr.message 
                });
            }
        }

        // --- FLUXO PADRÃO TECNOSPEED ---
        if (!config.tecnospeed_api_key) {
            return res.status(400).json({ error: 'Configuração TecnoSpeed incompleta (API Key ausente).' });
        }
        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase().replace(/\/$/, '');

        // --- AUTODESCORBERTA DE CERTIFICADO ---
        let certId = config.certificado_id || config.certificadoId || config.certificado;
        const hasCert = !!certId && certId !== 'null' && certId !== 'undefined';
        
        // --- DADOS DO PRESTADOR ---
        const firstItem = Array.isArray(payload) ? payload[0] : payload;
        const targetCnpj = (firstItem?.prestador?.cpfCnpj || '').replace(/\D/g, '');
        
        // --- DETECÇÃO DE MODO TESTE ---
        const TEST_CNPJ = '08187168000160'; 
        const TEST_IM_MUNICIPAL = '8214100099'; // Maringá
        const TEST_IM_NACIONAL = '1234567';     // Belo Horizonte (Nacional)
        
        // Se estivermos em Sandbox, a prioridade é FUNCIONAR. 
        // A Tecnospeed converteu o CNPJ de teste padrão para NFSe Nacional em Jun/2026.
        // Portanto, se for Municipal (!isNacional) e tiver certificado, ignoramos use_test_data e usamos os reais.
        const isNacional = !!(config.nfse_nacional || config.nfse?.config?.nfseNacional);
        const forceTestData = config.use_test_data === true && (!hasCert || isNacional);
        const useTestData = forceTestData || 
                          (isSandbox && !hasCert) || 
                          (targetCnpj === TEST_CNPJ || targetCnpj === '08184315000104') ||
                          isLabTest === true;

        const endpoint = type === 'nfse' ? 'nfse' : 'nfe';

        console.log(`🧾 [FISCAL-EMITIR] Ambiente: ${config.ambiente} | Sandbox: ${isSandbox} | HasCert: ${hasCert} (${certId}) | UseTestData: ${useTestData} | Nacional: ${isNacional}`);

        if (targetCnpj) {
            try {
                console.log(`🔍 [FISCAL-EMITIR] Tentando descobrir certificado oficial para ${targetCnpj}...`);
                const issuerInfo = await axios.get(`${baseUrl}/empresa/${targetCnpj}`, {
                    headers: { 'x-api-key': apiKey }
                });
                
                const discoverId = issuerInfo.data?.data?.certificado || issuerInfo.data?.certificado || issuerInfo.data?.data?.certificadoId;
                if (discoverId && !certId) certId = discoverId; // Só sobrescreve se não tiver no banco
            } catch (discoverErr: any) {
                console.warn(`⚠️ [FISCAL-EMITIR] Não foi possível autodescobrir o certificado`);
            }
        }

        // Injetar o certificado no payload se for NFSe
        let finalPayload = Array.isArray(payload) ? payload : [payload];
        
        if (endpoint === 'nfse') {
            finalPayload = finalPayload.map((item: any) => {
                if (!item.idIntegracao) {
                    item.idIntegracao = `NFSE_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
                } else if (useTestData) {
                    item.idIntegracao = `${item.idIntegracao}_${Date.now().toString().slice(-4)}`;
                }

                if (useTestData && !item.prestador) item.prestador = {};
                if (item.prestador) {
                    if (useTestData) {
                        item.prestador.cpfCnpj = TEST_CNPJ;
                        item.prestador.inscricaoMunicipal = isNacional ? TEST_IM_NACIONAL : TEST_IM_MUNICIPAL;
                        delete item.prestador.certificado; 
                    } else {
                        item.prestador.cpfCnpj = String(item.prestador.cpfCnpj || '').replace(/\D/g, '');
                        item.prestador.certificado = certId || item.prestador.certificado;
                    }
                }

                if (item.tomador && item.tomador.cpfCnpj) {
                    item.tomador.cpfCnpj = String(item.tomador.cpfCnpj).replace(/\D/g, '');
                }

                const targetIbge = isNacional ? '3106200' : '4115200';
                const targetIm = isNacional ? '1234567' : '8214100099';
                
                if (useTestData) {
                    delete item.versao;
                    if (item.servico) {
                        const services = Array.isArray(item.servico) ? item.servico : [item.servico];
                        services.forEach((s: any) => {
                            s.codigoIbge = targetIbge;
                            if (!s.iss) s.iss = { aliquota: 0, exigibilidade: 1, tipoTributacao: 7 };
                        });
                    }
                    if (item.codigoIbge) item.codigoIbge = targetIbge;
                    if (item.prestador) {
                        item.prestador.cpfCnpj = TEST_CNPJ;
                        item.prestador.inscricaoMunicipal = targetIm;
                        delete item.prestador.certificado;
                    }
                    if (isNacional) {
                        if (item.tomador && item.tomador.endereco) {
                            item.tomador.endereco.codigoCidade = targetIbge;
                            item.tomador.endereco.uf = 'MG';
                        }
                    }
                    // Inject unique rps.numero and rps.serie if missing, to bypass PlugNotas' disabled automatic numbering in sandbox
                    if (!item.rps) {
                        item.rps = {};
                    }
                    if (!item.rps.numero) {
                        item.rps.numero = Math.floor(Math.random() * 900000) + 100000;
                    } else {
                        item.rps.numero = Number(item.rps.numero);
                    }
                    if (!item.rps.serie) {
                        item.rps.serie = "1";
                    }
                } else {
                    const companyIbge = config.endereco?.codigoCidade || config.codigo_municipio || '3106200';
                    if (!item.codigoIbge) item.codigoIbge = companyIbge;
                    if (item.servico) {
                        const services = Array.isArray(item.servico) ? item.servico : [item.servico];
                        services.forEach((s: any) => {
                            if (!s.codigoIbge) s.codigoIbge = companyIbge;
                            if (!s.iss) s.iss = { aliquota: 0, exigibilidade: 1, tipoTributacao: isNacional ? 1 : 7 };
                        });
                    }
                }

                // Auto-sanitize and auto-calculate valorUnitario and total service value for NFSe validation
                if (item.servico) {
                    const services = Array.isArray(item.servico) ? item.servico : [item.servico];
                    services.forEach((s: any) => {
                        const qty = s.quantidade ? Number(s.quantidade) : 1;
                        const totalVal = s.valor?.servico ? Number(s.valor.servico) : 0;
                        const unitVal = s.valorUnitario ? Number(s.valorUnitario) : 0;

                        if (qty > 1) {
                            const calculatedTotal = totalVal > 0 ? totalVal : Number((unitVal * qty).toFixed(2));
                            const calculatedUnit = unitVal > 0 ? unitVal : Number((calculatedTotal / qty).toFixed(2));

                            s.quantidade = 1;
                            s.valorUnitario = calculatedTotal;
                            if (!s.valor) s.valor = {};
                            s.valor.servico = calculatedTotal;

                            const formattedUnit = calculatedUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            const formattedTotal = calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            const breakdownText = ` (${qty} x R$ ${formattedUnit} = R$ ${formattedTotal})`;

                            if (s.descricao && !s.descricao.includes(breakdownText) && !s.descricao.includes('x R$')) {
                                s.descricao = `${s.descricao}${breakdownText}`;
                            }
                            if (s.discriminacao && !s.discriminacao.includes(breakdownText) && !s.discriminacao.includes('x R$')) {
                                s.discriminacao = `${s.discriminacao}${breakdownText}`;
                            }
                        } else if (qty === 1 && totalVal > 0 && !s.valorUnitario) {
                            s.valorUnitario = totalVal;
                        }
                    });
                }

                // Garantir o campo versao se for Nacional (tanto para teste quanto real)
                if (isNacional) {
                    item.versao = '1.00';
                }

                // ===================================================
                // SANITIZAÇÃO ESPECÍFICA PARA NFS-e NACIONAL (ABRASF 2.04)
                // O endpoint /nfse/nacional tem schema estrito e rejeita
                // campos inválidos ou fora do intervalo aceito.
                // ===================================================
                if (isNacional && !useTestData) {
                    // 1. tipoTributacao deve ser 1-6 para Nacional (7 = Isento é só municipal)
                    if (item.servico) {
                        const services = Array.isArray(item.servico) ? item.servico : [item.servico];
                        services.forEach((s: any) => {
                            if (s.iss) {
                                // Se tipoTributacao for 7 (inválido no Nacional), converte para 1 (Normal)
                                if (!s.iss.tipoTributacao || s.iss.tipoTributacao > 6 || s.iss.tipoTributacao < 1) {
                                    s.iss.tipoTributacao = 1; // Normal (ISS devido)
                                }
                                // Se aliquota 0 com exigibilidade 1 (exigível), ajusta para exigibilidade 2 (Não incidência)
                                if (s.iss.aliquota === 0 && s.iss.exigibilidade === 1) {
                                    s.iss.exigibilidade = 2; // Não incidência
                                    s.iss.tipoTributacao = 3; // Isenção
                                }
                                // aliquota deve ser um número positivo para tipo Normal (1)
                                if (s.iss.tipoTributacao === 1 && (s.iss.aliquota === 0 || !s.iss.aliquota)) {
                                    const cfgAliquota = parseFloat(config.simples_nacional_aliquota || config.default_iss_aliquota || '0');
                                    s.iss.aliquota = cfgAliquota > 0 ? cfgAliquota : 2; // Usa config ou 2% como fallback
                                }
                            }
                            // 2. Remove cnae do servico para Nacional (não faz parte do schema)
                            delete s.cnae;
                            // 3. Remove campos municipais que não existem no Nacional
                            delete s.pis;
                            delete s.cofins;
                            delete s.inss;
                            delete s.ir;
                            delete s.csll;
                        });
                    }
                    // 4. Garante codigoCidade do tomador seja apenas números (7 dígitos IBGE)
                    if (item.tomador?.endereco?.codigoCidade) {
                        item.tomador.endereco.codigoCidade = String(item.tomador.endereco.codigoCidade).replace(/\D/g, '').substring(0, 7);
                    }
                    // 5. Remove campos municipais do item raiz que não existem no Nacional
                    delete item.pis;
                    delete item.cofins;
                }

                return item;
            });
        }

        // Em sandbox/teste, o PlugNotas não suporta /nfse/nacional com o CNPJ de teste padrão.
        // Só usamos o endpoint Nacional em PRODUÇÃO com dados reais.
        const targetEndpoint = (endpoint === 'nfse' && isNacional && !useTestData && !isSandbox) ? 'nfse/nacional' : endpoint;
        console.log(`🧾 [FISCAL-EMITIR] Payload Final (Proxy v1.0.35) → ${targetEndpoint} | Nacional: ${isNacional} | Sandbox: ${isSandbox} | TestData: ${useTestData}:`, JSON.stringify(finalPayload, null, 2));

        const response = await axios.post(`${baseUrl}/${targetEndpoint}`, finalPayload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            }
        });

        const doc = response.data?.documents?.[0] || 
                    (Array.isArray(response.data) ? response.data[0] : 
                    (Array.isArray(response.data?.data) ? response.data.data[0] : 
                    (response.data?.data || response.data)));
        
        const externalId = doc?.id || doc?.protocolo || response.data?.id || response.data?.protocolo || response.data?.data?.id;

        if (externalId && SUPABASE_URL) {
            console.log(`💾 [DB-SAVE] Tentando salvar nota ${externalId} para empresa ${resolvedId}`);
            try {
                const status = doc?.status || response.data?.status || response.data?.data?.status || 'processando';

                const getValidDocUrl = (docType: 'pdf' | 'xml') => {
                    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                    const host = req.get('host');
                    const baseApiUrl = `${protocol}://${host}`;
                    const targetType = endpoint === 'nfse' && isNacional ? 'nfsenac' : endpoint;
                    return `${baseApiUrl}/api/fiscal-module/${targetType}/${externalId}/${docType}?companyId=${companyId}`;
                };

                const pdfUrl = getValidDocUrl('pdf');
                const xmlUrl = getValidDocUrl('xml');

                const dbResponse = await axios.post(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                    company_id: resolvedId,
                    quote_id: quoteId || null,
                    external_id: externalId,
                    type: endpoint === 'nfse' && isNacional ? 'nfsenac' : endpoint,
                    status: String(status).toLowerCase(),
                    pdf_url: pdfUrl,
                    xml_url: xmlUrl,
                    payload: {
                        ...(finalPayload[0] || finalPayload),
                        retorno: response.data
                    }
                }, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY!,
                        'Authorization': authHeader!,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    }
                });
                console.log(`✅ [DB-SAVE] Nota salva com sucesso. Status: ${dbResponse.status}`);
            } catch (dbErr: any) {
                console.error('❌ [DB-SAVE] Erro ao salvar nota no banco:', {
                    message: dbErr.message,
                    status: dbErr.response?.status,
                    detail: dbErr.response?.data
                });
            }
        }

        res.json({ ...response.data, proxy_version: '1.0.32' });
    } catch (error: any) {
        res.status(error.response?.status || 500).json({ error: error.message, detail: error.response?.data });
    }
});

app.post(['/fiscal-module/sync-issuer', '/api/fiscal-module/sync-issuer'], authenticate, async (req, res) => {
    const { companyId, config } = req.body;
    const authHeader = req.headers.authorization;

    try {
        // --- INTERCEPTOR DE WEBHOOK EXTERNO PARA EMITENTE ---
        if (config.use_external_webhook && config.external_webhook_url) {
            console.log(`🚀 [EXTERNAL-MODE] Sincronizando emitente com o webhook externo: ${config.external_webhook_url}`);
            
            const headers: any = { 
                'Content-Type': 'application/json',
                'X-Source': 'LucroCerto-Fiscal-Proxy',
                'X-Company-ID': companyId
            };

            if (config.external_webhook_token) {
                headers['Authorization'] = `Bearer ${config.external_webhook_token}`;
            }

            const issuerPayload = {
                cpfCnpj: (config.cnpj || '').replace(/\D/g, ''),
                inscricaoEstadual: (config.inscricao_estadual || '').replace(/\D/g, '') || '',
                inscricaoMunicipal: (config.inscricao_municipal || '').replace(/\D/g, '') || '',
                razaoSocial: config.razao_social || '',
                nomeFantasia: config.nome_fantasia || config.razao_social || '',
                simplesNacional: config.regime_tributario === '1',
                regimeTributario: parseInt(config.regime_tributario) || 1,
                email: config.email || 'suporte@lucrocerto.com.br',
                certificado: config.certificado_id || 'external-cert-id',
                telefone: {
                    ddd: (config.telefone || '').replace(/\D/g, '').substring(0, 2) || '44',
                    numero: (config.telefone || '').replace(/\D/g, '').substring(2) || '30379500'
                },
                endereco: {
                    logradouro: (config.endereco?.logradouro || config.logradouro || '').trim(),
                    numero: (config.endereco?.numero || config.numero || 'SN').trim(),
                    bairro: (config.endereco?.bairro || config.bairro || 'Centro').trim(),
                    cep: (config.endereco?.cep || config.cep || '').replace(/\D/g, ''),
                    codigoCidade: (config.endereco?.codigoCidade || config.codigo_municipio || '').trim(),
                    uf: (config.endereco?.uf || config.uf || '').trim().toUpperCase(),
                    complemento: (config.endereco?.complemento || config.complemento || '').trim()
                }
            };

            const syncPayload = {
                action: 'sync_issuer',
                company_id: companyId,
                payload: issuerPayload
            };

            try {
                await axios.post(config.external_webhook_url, syncPayload, {
                    headers,
                    timeout: 15000
                });
                console.log(`✅ [EXTERNAL-MODE] Sincronização de emitente disparada com sucesso.`);
            } catch (webhookErr: any) {
                console.warn(`⚠️ [EXTERNAL-MODE] Webhook externo de sincronização de emitente retornou erro:`, webhookErr.message);
            }

            // Salva no Supabase para persistir
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
                    
                    // Invalida todas as chaves do cache local para esta empresa
                    const cleanCnpj = config.cnpj ? String(config.cnpj).replace(/\D/g, '') : null;
                    for (const [key, cached] of fiscalConfigCache.entries()) {
                        if (
                            key === companyId || 
                            cached.realCompanyId === companyId || 
                            (cleanCnpj && (key === cleanCnpj || String(cached.config?.cnpj || '').replace(/\D/g, '') === cleanCnpj))
                        ) {
                            fiscalConfigCache.delete(key);
                        }
                    }
                    fiscalConfigCache.delete(companyId);
                    
                    console.log('✅ Configuração fiscal persistida no Supabase após sincronização externa.');
                } catch (dbErr: any) {
                    console.warn('⚠️ Falha ao salvar config no banco:', dbErr.message);
                }
            }

            return res.json({
                success: true,
                message: 'Emitente sincronizado via Webhook Externo com sucesso',
                proxy_version: '1.0.31',
                synced_id: config.certificado_id || 'external-cert-id',
                endereco: issuerPayload.endereco,
                telefone: issuerPayload.telefone,
                razaoSocial: issuerPayload.razaoSocial
            });
        }

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

        // DADOS DE TESTE DA TECNOSPEED (DINÂMICO PARA MUNICIPAL OU NACIONAL)
        const isNacional = !!config.nfse_nacional;
        const TECNOSPEED_TEST_DATA = {
            cnpj: TEST_CNPJ,
            razaoSocial: 'TECNOSPEED TECNOLOGIA DA INFORMACAO LTDA',
            inscricaoMunicipal: isNacional ? '1234567' : '123456',
            endereco: {
                logradouro: isNacional ? 'Rua Teste Nacional' : 'Avenida Duque de Caxias',
                numero: isNacional ? '123' : '882',
                bairro: isNacional ? 'Centro' : 'Zona 07',
                cep: isNacional ? '31000000' : '87020025',
                codigoCidade: isNacional ? '3106200' : '4115200',
                uf: isNacional ? 'MG' : 'PR',
                complemento: isNacional ? '' : 'SALA 01'
            }
        };

        const TEST_CNPJ_FORMATTED = '08.184.315/0001-04';
        const TEST_CNPJ_CLEAN = '08184315000104';

        // Voltando a usar o CNPJ REAL do usuário, pois a API Key é privada e vinculada ao CNPJ dele.
        const effectiveCnpj = cnpj; 
        const effectiveCnpjUrl = effectiveCnpj.replace(/\D/g, '');

        const issuerPayload = {
            cpfCnpj: effectiveCnpjUrl,
            cnpj: effectiveCnpjUrl,
            cpf_cnpj: effectiveCnpjUrl, 
            inscricaoEstadual: useTestData ? '' : ((config.inscricao_estadual || '').replace(/\D/g, '') || ''),
            inscricaoMunicipal: useTestData ? TECNOSPEED_TEST_DATA.inscricaoMunicipal : ((config.inscricao_municipal || '').replace(/\D/g, '') || ''),
            razaoSocial: useTestData ? TECNOSPEED_TEST_DATA.razaoSocial : (config.razao_social || ''),
            nomeFantasia: useTestData ? TECNOSPEED_TEST_DATA.razaoSocial : (config.nome_fantasia || config.razao_social || ''),
            simplesNacional: config.regime_tributario === '1',
            regimeTributario: parseInt(config.regime_tributario) || 1,
            email: config.email || 'suporte@lucrocerto.com.br',
            certificado: config.certificado_id || config.certificadoId || config.certificado || '',
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
                config: { 
                    producao: config.ambiente === 'producao',
                    rps: {
                        numeracaoAutomatica: true,
                        numeracao: [
                            {
                                serie: "1",
                                numero: 1
                            }
                        ]
                    },
                    nfseNacional: !!config.nfse_nacional,
                    ...(config.reforma_tributaria_calculadora_ativa ? {
                        calculadoraAutomatica: {
                            regimeGeral: {
                                ativo: true
                            }
                        }
                    } : {})
                }
            },
            nfe: {
                ativo: true,
                config: { 
                    producao: config.ambiente === 'producao',
                    numeracaoAutomatica: true,
                    ...(config.reforma_tributaria_calculadora_ativa ? {
                        calculadoraAutomatica: {
                            regimeGeral: {
                                ativo: true
                            }
                        }
                    } : {})
                }
            }
        };

        console.log('🚀 [FISCAL-SYNC] Enviando Payload para TecnoSpeed:', JSON.stringify({
            url: `${baseUrl}/empresa`,
            cnpj: effectiveCnpjUrl,
            is_test_mode: useTestData
        }, null, 2));

        // Já definido na linha 335
        let response;
        try {
            if (useTestData) {
                try {
                    response = await axios.get(`${baseUrl}/empresa/${effectiveCnpjUrl}`, {
                        headers: { 'x-api-key': apiKey }
                    });
                    // Se existe, vamos atualizar as configurações para que fiquem sincronizadas (como o nfseNacional)
                    response = await axios.put(`${baseUrl}/empresa/${effectiveCnpjUrl}`, issuerPayload, {
                        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
                    });
                } catch (getErr: any) {
                    if (getErr.response?.status === 404) {
                        response = await axios.post(`${baseUrl}/empresa`, issuerPayload, {
                            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
                        });
                    } else {
                        throw getErr;
                    }
                }
            } else {
                try {
                    response = await axios.post(`${baseUrl}/empresa`, issuerPayload, {
                        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
                    });
                } catch (error: any) {
                    if (error.response?.status === 409) {
                        response = await axios.put(`${baseUrl}/empresa/${effectiveCnpjUrl}`, issuerPayload, {
                            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
                        });
                    } else {
                        throw error;
                    }
                }
            }
        } catch (error: any) {
            const errorDetail = error.response?.data || error.message;
            console.error('❌ [FISCAL-SYNC] Erro na TecnoSpeed:', JSON.stringify(errorDetail, null, 2));
            
            // --- GRACEFUL BYPASS PARA AMBIENTE DE HOMOLOGAÇÃO ---
            if (isSandbox) {
                console.warn('⚠️ [FISCAL-SYNC-SANDBOX-BYPASS] Erro na PlugNotas em homologação. Persistindo configuração no banco local para permitir testes.');
                
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
                        console.log('✅ [SANDBOX] Configuração fiscal persistida no Supabase mesmo após erro/conflito na TecnoSpeed.');
                        
                        // Invalida todas as chaves do cache local para esta empresa
                        const cleanCnpj = config.cnpj ? String(config.cnpj).replace(/\D/g, '') : null;
                        for (const [key, cached] of fiscalConfigCache.entries()) {
                            if (
                                key === companyId || 
                                cached.realCompanyId === companyId || 
                                (cleanCnpj && (key === cleanCnpj || String(cached.config?.cnpj || '').replace(/\D/g, '') === cleanCnpj))
                            ) {
                                fiscalConfigCache.delete(key);
                            }
                        }
                        fiscalConfigCache.delete(companyId);
                    } catch (dbErr: any) {
                        console.warn('⚠️ Falha ao salvar config no banco local:', dbErr.message);
                    }
                }

                return res.json({
                    success: true,
                    message: 'Emitente atualizado localmente com sucesso (Bypass Homologação)',
                    proxy_version: '1.0.35',
                    synced_id: issuerPayload.certificado || config.certificado_id || '',
                    warning: 'O PlugNotas retornou um erro ou conflito (comum ao usar chaves públicas compartilhadas), mas a configuração foi salva no banco local do Lucro Certo. Você pode prosseguir com os testes de emissão.',
                    detail: errorDetail
                });
            }

            return res.status(error.response?.status || 500).json({ 
                error: error.message, 
                detail: errorDetail 
            });
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

        res.json({ ...response.data, proxy_version: '1.0.15', synced_id: issuerPayload.certificado });
    } catch (outerError: any) {
        res.status(500).json({ error: outerError.message });
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
        
        // Invalida todas as chaves do cache local para esta empresa (UUID, CNPJ ou chaves curtas)
        const cleanCnpj = config.cnpj ? String(config.cnpj).replace(/\D/g, '') : null;
        for (const [key, cached] of fiscalConfigCache.entries()) {
            if (
                key === companyId || 
                cached.realCompanyId === companyId || 
                (cleanCnpj && (key === cleanCnpj || String(cached.config?.cnpj || '').replace(/\D/g, '') === cleanCnpj))
            ) {
                fiscalConfigCache.delete(key);
            }
        }
        // Fallback redundante por segurança
        fiscalConfigCache.delete(companyId);

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



app.get(['/fiscal-module/consultar/periodo', '/api/fiscal-module/consultar/periodo'], authenticate, async (req, res) => {
    const { companyId, dataInicial, dataFinal, tipo, ator } = req.query;
    const authHeader = req.headers.authorization;

    if (!companyId || !dataInicial || !dataFinal) {
        return res.status(400).json({ error: 'companyId, dataInicial e dataFinal são obrigatórios.' });
    }

    try {
        const { config, settings } = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const activeProvider = settings?.fiscal_provider || 'tecnospeed';

        if (activeProvider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta (Chave de API ou ID da Empresa ausente).' });
            }

            const isSandbox = nfeioConfig.ambiente === 'homologacao';
            const apiKeyNfe = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            console.log(`🔍 [NFEIO-CONSULTAR] Listando notas NFe.io para empresa: ${companyIdNfe}`);
            
            const response = await axios.get(`https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices`, {
                params: {
                    environment: isSandbox ? 'test' : 'production'
                },
                headers: {
                    'Authorization': apiKeyNfe
                }
            });

            const serviceInvoices = response.data?.serviceInvoices || [];
            
            // Filtrar na memória por dataInicial e dataFinal se fornecidos
            const start = dataInicial ? new Date(`${dataInicial}T00:00:00`) : null;
            const end = dataFinal ? new Date(`${dataFinal}T23:59:59`) : null;

            const filtered = serviceInvoices.filter((item: any) => {
                if (!item.createdOn) return false;
                const createdDate = new Date(item.createdOn);
                if (start && createdDate < start) return false;
                if (end && createdDate > end) return false;
                return true;
            });

            const mappedNotas = filtered.map((item: any) => {
                const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                const host = req.get('host');
                const baseApiUrl = `${protocol}://${host}`;
                const pdfUrl = `${baseApiUrl}/api/fiscal-module/nfeio/${item.id}/pdf?companyId=${companyId}`;
                const xmlUrl = `${baseApiUrl}/api/fiscal-module/nfeio/${item.id}/xml?companyId=${companyId}`;
                
                let situacao = 'PROCESSANDO';
                const s = String(item.status || item.flowStatus || '').trim().toLowerCase();
                if (s === 'issued' || s === 'issuedcontingency') situacao = 'CONCLUIDO';
                else if (s === 'cancelled') situacao = 'CANCELADO';
                else if (s === 'error' || s === 'issuedenied') situacao = 'ERRO';

                return {
                    id: item.id,
                    situacao,
                    tomador: item.borrower?.federalTaxNumber || 'CLIENTE NAO IDENTIFICADO',
                    emissao: item.createdOn ? new Date(item.createdOn).toLocaleDateString('pt-BR') : '',
                    autorizacao: item.createdOn ? new Date(item.createdOn).toLocaleDateString('pt-BR') : '',
                    valorServico: item.servicesAmount || 0,
                    numeroNfse: item.number ? String(item.number) : '',
                    pdf: pdfUrl,
                    xml: xmlUrl
                };
            });

            return res.json({ success: true, notas: mappedNotas });
        }

        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const rawBase = isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase);
        const baseUrl = String(rawBase).toLowerCase().replace(/\/$/, '');

        let cnpj = (config.cnpj || '').replace(/\D/g, '');
        
        const certId = config.certificado_id || config.certificadoId || config.certificado;
        const hasCert = !!certId && certId !== 'null' && certId !== 'undefined';
        const isNacional = !!(config.nfse_nacional || config.nfse?.config?.nfseNacional);
        const forceTestData = config.use_test_data === true && (!hasCert || isNacional);
        const useTestData = forceTestData || (isSandbox && !hasCert);
        
        if (useTestData) {
            cnpj = '08187168000160'; // CNPJ da TecnoSpeed usado no modo teste/sandbox
            console.log(`🛠️ [FISCAL-CONSULTAR] Modo Teste Ativo. Forçando CNPJ para ${cnpj} para localizar as notas do Sandbox.`);
        }

        if (!cnpj) {
            return res.status(400).json({ error: 'CNPJ da empresa não configurado.' });
        }

        const endpoint = tipo === 'nfe' ? 'nfe' : 'nfse/nacional';
        const url = `${baseUrl}/${endpoint}/${cnpj}/consultar/periodo`;
        
        console.log(`🔍 [FISCAL-CONSULTAR] Solicitando notas de ${dataInicial} a ${dataFinal} para ${cnpj} (${endpoint})`);
        
        const response = await axios.get(url, {
            params: {
                dataInicial,
                dataFinal,
                ator: ator || 1 // 1 para Emitente/Prestador por padrão
            },
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            }
        });

        res.json({ success: true, ...response.data });
    } catch (error: any) {
        console.error('❌ Erro ao consultar notas:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: 'Falha ao consultar notas na TecnoSpeed', 
            detail: error.response?.data || error.message 
        });
    }
});

app.get(['/fiscal-module/:type/:id/pdf', '/api/fiscal-module/:type/:id/pdf', '/fiscal-module/:type/:id/xml', '/api/fiscal-module/:type/:id/xml'], authenticate, async (req, res) => {
    const { type, id } = req.params;
    const { companyId, token } = req.query;
    const authHeader = req.headers.authorization || (token ? `Bearer ${token}` : null);
    const isXml = req.path.endsWith('/xml') || req.path.includes('/xml');

    if (!companyId || !id) {
        return res.status(400).json({ error: 'companyId e ID da nota são obrigatórios' });
    }

    try {
        // Tentar obter a configuração usando a função com cache
        const { config, settings } = await getCompanyFiscalConfig(authHeader, companyId as string);

        if (type === 'nfeio' || settings?.fiscal_provider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(404).json({ error: 'Configuração da NFe.io não encontrada.' });
            }

            const apiKeyNfe = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            console.log(`📄 [NFEIO-DOWNLOAD] Baixando ${isXml ? 'XML' : 'PDF'} para nota NFe.io ID: ${id}`);
            
            const response = await axios.get(`https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}/${isXml ? 'xml' : 'pdf'}`, {
                headers: {
                    'Authorization': apiKeyNfe
                },
                responseType: 'arraybuffer'
            });

            res.setHeader('Content-Type', isXml ? 'application/xml' : 'application/pdf');
            res.setHeader('Content-Disposition', `${isXml ? 'attachment' : 'inline'}; filename="${type}-${id}.${isXml ? 'xml' : 'pdf'}"`);
            return res.send(Buffer.from(response.data));
        }

        if (!config || !config.tecnospeed_api_key) {
            return res.status(404).json({ error: 'Configuração fiscal não encontrada ou sem API Key.' });
        }

        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const rawBase = isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase);
        const baseUrl = String(rawBase).toLowerCase().replace(/\/$/, '');

        let primaryType = type;
        if (type === 'nfse' || type === 'nfsenac') {
            const isNacional = type === 'nfsenac' || !!config.nfse_nacional;
            primaryType = isNacional ? 'nfse/nacional' : 'nfse';
        }

        console.log(`📄 [FISCAL-DOWNLOAD] Baixando ${isXml ? 'XML' : 'PDF'} para ${primaryType} ID: ${id}`);

        try {
            const response = await axios.get(`${baseUrl}/${primaryType}/${isXml ? 'xml' : 'pdf'}/${id}`, {
                headers: { 'x-api-key': apiKey },
                responseType: 'arraybuffer'
            });

            res.setHeader('Content-Type', isXml ? 'application/xml' : 'application/pdf');
            res.setHeader('Content-Disposition', `${isXml ? 'attachment' : 'inline'}; filename="${type}-${id}.${isXml ? 'xml' : 'pdf'}"`);
            return res.send(Buffer.from(response.data));
        } catch (primaryErr: any) {
            const isNfseEndpoint = primaryType === 'nfse' || primaryType === 'nfse/nacional';
            const is404 = primaryErr.response?.status === 404;

            if (isNfseEndpoint && is404) {
                const fallbackType = primaryType === 'nfse' ? 'nfse/nacional' : 'nfse';
                console.log(`⚠️ [FISCAL-DOWNLOAD] Não encontrado em ${primaryType}. Tentando fallback em ${fallbackType}...`);
                try {
                    const response = await axios.get(`${baseUrl}/${fallbackType}/${isXml ? 'xml' : 'pdf'}/${id}`, {
                        headers: { 'x-api-key': apiKey },
                        responseType: 'arraybuffer'
                    });

                    res.setHeader('Content-Type', isXml ? 'application/xml' : 'application/pdf');
                    res.setHeader('Content-Disposition', `${isXml ? 'attachment' : 'inline'}; filename="${type}-${id}.${isXml ? 'xml' : 'pdf'}"`);
                    return res.send(Buffer.from(response.data));
                } catch (fallbackErr: any) {
                    console.error(`❌ [FISCAL-DOWNLOAD] Erro no fallback (${fallbackType}):`, fallbackErr.response?.data || fallbackErr.message);
                }
            }

            // Propaga o erro original caso não seja elegível para fallback ou o fallback também falhe
            throw primaryErr;
        }
    } catch (error: any) {
        console.error('❌ Erro no download fiscal:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: 'Erro ao baixar documento da TecnoSpeed', 
            detail: error.response?.data || error.message 
        });
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

app.get(['/fiscal-module/cidades/:codigoIbge', '/api/fiscal-module/cidades/:codigoIbge'], authenticate, async (req, res) => {
    const { codigoIbge } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const { config } = await getCompanyFiscalConfig(authHeader!, companyId as string);
        if (!config || !config.tecnospeed_api_key) {
            return res.status(400).json({ error: 'Configuração TecnoSpeed incompleta (API Key ausente).' });
        }
        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase().replace(/\/$/, '');

        const cleanIbge = String(codigoIbge).replace(/\D/g, '');
        console.log(`🔍 [FISCAL-CIDADES] Consultando cidade IBGE: ${cleanIbge} em ${isSandbox ? 'SANDBOX' : 'PROD'}...`);

        const response = await axios.get(`${baseUrl}/nfse/cidades/${cleanIbge}`, {
            headers: { 
                'x-api-key': apiKey,
                'X-API-KEY': apiKey
            }
        });

        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        const statusCode = error.response?.status || 500;
        console.error(`❌ Erro ao consultar cidade ${codigoIbge} (Status ${statusCode}):`, JSON.stringify(errorDetail, null, 2));
        res.status(statusCode).json({ error: 'Erro ao consultar cidade na TecnoSpeed', detail: errorDetail });
    }
});

app.get(['/fiscal-module/status/:id', '/api/fiscal-module/status/:id'], authenticate, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    // Proteção Anti-Crash: Se o ID não for um ObjectID de 24 caracteres hexadecimais do PlugNotas,
    // significa que é um ID de integração temporário (como UUID_lote).
    // Retornamos status "processando" amigável para evitar erro 500 na TecnoSpeed e popups chatos no frontend.
    const isObjectId = /^[0-9a-fA-F]{24}$/.test((id as string) || '');
    if (!isObjectId) {
        console.log(`⚠️ [FISCAL-STATUS-BYPASS] ID informado (${id}) é um ID de integração. Retornando status processando.`);
        return res.json({
            status: 'processando',
            message: 'Nota em processamento ou aguardando autorização da prefeitura.',
            data: {
                status: 'processando'
            }
        });
    }

    try {
        const { config, realCompanyId: resolvedId, settings } = await getCompanyFiscalConfig(authHeader!, companyId as any);
        const apiKey = config.tecnospeed_api_key?.trim().toLowerCase();
        const isSandbox = config.ambiente === 'homologacao';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || 'https://api.sandbox.plugnotas.com.br') : (config.endpoint_producao || 'https://api.plugnotas.com.br')).toLowerCase().replace(/\/$/, '');

        // 1. Tentar descobrir o tipo da nota no nosso banco (NFS-e ou NF-e)
        let type = 'nfse'; // Default para NFSe que é o mais comum no projeto
        let isRecordFound = false;
        let existingPayload: any = {};
        try {
            const { data: invData } = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                params: {
                    external_id: `eq.${id}`,
                    select: 'type,payload'
                },
                headers: {
                    'apikey': SUPABASE_ANON_KEY!,
                    'Authorization': authHeader!
                }
            });
            if (invData?.[0]) {
                type = invData[0].type || 'nfse';
                existingPayload = invData[0].payload || {};
                isRecordFound = true;
                console.log(`🔍 [FISCAL-STATUS] Tipo detectado no banco para ${id}: ${type}`);
            }
        } catch (dbErr) {
            console.warn(`⚠️ [FISCAL-STATUS] Não foi possível detectar o tipo da nota ${id} no banco. Tentando ${type} por padrão.`);
        }

        const activeProvider = settings?.fiscal_provider || 'tecnospeed';

        if (type === 'nfeio' || (activeProvider === 'nfeio' && !isRecordFound)) {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta.' });
            }

            const apiKeyNfe = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            console.log(`🔍 [NFEIO-STATUS] Consultando status da nota NFe.io ID: ${id}`);
            
            const response = await axios.get(`https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}`, {
                headers: {
                    'Authorization': apiKeyNfe
                }
            });

            const statusData = response.data;
            const currentStatus = statusData.status || statusData.flowStatus || 'Created';

            if (currentStatus && SUPABASE_URL) {
                try {
                    const getValidDocUrl = (docType: 'pdf' | 'xml') => {
                        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                        const host = req.get('host');
                        const baseApiUrl = `${protocol}://${host}`;
                        return `${baseApiUrl}/api/fiscal-module/nfeio/${id}/${docType}?companyId=${companyId}`;
                    };

                    const pdfUrl = getValidDocUrl('pdf');
                    const xmlUrl = getValidDocUrl('xml');

                    const invoiceNumber = statusData.number || null;
                    const accessKey = statusData.verificationCode || null;
                    const rpsNumber = statusData.rpsNumber || null;
                    const rpsSerie = statusData.rpsSerialNumber || null;
                    const protocol = statusData.protocol || null;

                    const mappedStatus = String(currentStatus).toLowerCase() === 'issued' ? 'concluido' : (String(currentStatus).toLowerCase() === 'cancelled' ? 'cancelado' : (String(currentStatus).toLowerCase() === 'error' ? 'erro' : 'processando'));

                    await axios.patch(`${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${id}`, {
                        status: mappedStatus,
                        pdf_url: pdfUrl,
                        xml_url: xmlUrl,
                        invoice_number: invoiceNumber ? String(invoiceNumber) : null,
                        access_key: accessKey ? String(accessKey) : null,
                        dps_number: rpsNumber ? String(rpsNumber) : null,
                        dps_serie: rpsSerie ? String(rpsSerie) : null,
                        protocol: protocol ? String(protocol) : null,
                        payload: {
                            ...existingPayload,
                            retorno: statusData
                        },
                        updated_at: new Date().toISOString()
                    }, {
                        headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader!, 'Content-Type': 'application/json' }
                    });
                } catch (dbErr: any) {
                    console.warn('⚠️ Falha ao atualizar status local NFe.io:', dbErr.message);
                }
            }

            return res.json(statusData);
        }

        // Determinar se é nacional:
        // 1. Se achou no banco, é nacional se type for 'nfsenac'.
        // 2. Se não achou no banco (avulsa), usa a config atual da empresa.
        const isNacional = isRecordFound 
            ? (type === 'nfsenac') 
            : !!(config.nfse_nacional || config.nfse?.config?.nfseNacional);
            
        // Determina o endpoint para consulta. Se for Nacional, tenta nfse/nacional primeiro,
        // com fallback para nfse caso a nota tenha sido emitida pelo endpoint municipal (compatibilidade retroativa).
        const targetType = isNacional ? 'nfse/nacional' : (type === 'nfse' || type === 'nfsenac' ? 'nfse' : type);

        // 2. Consultar na TecnoSpeed usando o endpoint correto, com fallback automático
        let statusData: any;
        let usedType = targetType;
        
        try {
            const response = await axios.get(`${baseUrl}/${targetType}/${id}`, {
                headers: { 'X-API-KEY': apiKey }
            });
            statusData = response.data;
        } catch (primaryErr: any) {
            // Fallback: se nfse/nacional retornou 404, tenta em nfse (nota pode ter sido emitida municipalmente)
            if (primaryErr.response?.status === 404 && targetType === 'nfse/nacional') {
                console.warn(`⚠️ [FISCAL-STATUS] Nota não encontrada em /nfse/nacional. Tentando fallback em /nfse...`);
                try {
                    const fallbackResponse = await axios.get(`${baseUrl}/nfse/${id}`, {
                        headers: { 'X-API-KEY': apiKey }
                    });
                    statusData = fallbackResponse.data;
                    usedType = 'nfse';
                    console.log(`✅ [FISCAL-STATUS] Nota encontrada no fallback /nfse. ID: ${id}`);
                } catch (fallbackErr: any) {
                    // Também não encontrou em /nfse → propaga o erro original (404)
                    throw primaryErr;
                }
            } else {
                throw primaryErr;
            }
        }
        
        // Extrair status (NFSe Nacional tem estrutura diferente as vezes)
        const currentStatus = statusData.data?.status || statusData.status;

        if (currentStatus && SUPABASE_URL) {
            try {
                const getValidDocUrl = (docType: 'pdf' | 'xml') => {
                    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                    const host = req.get('host');
                    const baseApiUrl = `${protocol}://${host}`;
                    return `${baseApiUrl}/api/fiscal-module/${usedType}/${id}/${docType}?companyId=${companyId}`;
                };

                const pdfUrl = getValidDocUrl('pdf');
                const xmlUrl = getValidDocUrl('xml');

                const innerData = statusData.data || statusData;
                const invoiceNumber = innerData.numeroNfse || innerData.numero || innerData.numeroNfe || null;
                const accessKey = innerData.chaveAcesso || innerData.chave_acesso || null;
                const dpsNumber = innerData.dps?.numero || innerData.nacional?.dps?.numero || innerData.DPS?.infDPS?.nDPS || innerData.nDPS || innerData.rps?.numero || null;
                const dpsSerie = innerData.dps?.serie || innerData.nacional?.dps?.serie || innerData.DPS?.infDPS?.serie || innerData.serie || innerData.rps?.serie || null;
                const plugnotasId = innerData.id || null;
                const protocol = innerData.protocolo || innerData.recibo || innerData.protocoloAutorizacao || null;

                const updatedPayload = {
                    ...existingPayload,
                    retorno: statusData
                };

                await axios.patch(`${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${id}`, {
                    status: String(currentStatus).toLowerCase(),
                    pdf_url: pdfUrl,
                    xml_url: xmlUrl,
                    invoice_number: invoiceNumber ? String(invoiceNumber) : null,
                    access_key: accessKey ? String(accessKey) : null,
                    dps_number: dpsNumber ? String(dpsNumber) : null,
                    dps_serie: dpsSerie ? String(dpsSerie) : null,
                    plugnotas_id: plugnotasId ? String(plugnotasId) : null,
                    protocol: protocol ? String(protocol) : null,
                    payload: updatedPayload,
                    updated_at: new Date().toISOString()
                }, {
                    headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader!, 'Content-Type': 'application/json' }
                });
            } catch (dbErr) { console.warn('⚠️ Falha ao atualizar status local'); }
        }
        res.json(statusData);
    } catch (error: any) {
        const detail = error.response?.data || error.message;
        const statusCode = error.response?.status || 500;
        console.error('❌ [FISCAL-STATUS] Erro:', JSON.stringify(detail));
        res.status(statusCode).json({ error: 'Erro ao consultar status', detail: detail });
    }
});

app.post(['/fiscal-module/:type/:id/email', '/api/fiscal-module/:type/:id/email'], authenticate, async (req, res) => {
    let { type, id } = req.params;
    const { companyId } = req.query;
    const { destinatarios } = req.body;
    const authHeader = req.headers.authorization;

    if (!companyId || !id) {
        return res.status(400).json({ error: 'companyId e ID da nota são obrigatórios' });
    }

    try {
        const { config, settings } = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const activeProvider = settings?.fiscal_provider || 'tecnospeed';

        // Se o tipo não for explícito, tentar detectar
        if (type !== 'nfe' && type !== 'nfse' && type !== 'nfeio') {
            try {
                const { data: invData } = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                    params: { external_id: `eq.${id}`, select: 'type' },
                    headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader! }
                });
                if (invData?.[0]?.type) {
                    type = invData[0].type;
                    console.log(`🔍 [FISCAL-EMAIL] Tipo detectado no banco: ${type}`);
                }
            } catch (dbErr: any) { 
                console.warn(`⚠️ [FISCAL-EMAIL] Falha ao detectar tipo no banco para ${id}:`, dbErr.message);
            }
        }

        if (type === 'nfeio' || activeProvider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta para reenvio de e-mail.' });
            }
            const apiKeyNfe = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            console.log(`✉️ [NFEIO-EMAIL] Solicitando reenvio de e-mail para nota NFe.io ID: ${id}`);
            const response = await axios.put(`https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}/sendemail`, {}, {
                headers: {
                    'Authorization': apiKeyNfe
                }
            });

            return res.json({ success: true, data: response.data });
        }

        const apiKey = sanitizeKey(config.tecnospeed_api_key);
        const isSandbox = config.ambiente === 'homologacao';
        const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
        const rawBase = isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase);
        const baseUrl = String(rawBase).toLowerCase().replace(/\/$/, '');

        const targetUrl = `${baseUrl}/${type}/email/${id}`;
        console.log(`✉️ [FISCAL-EMAIL] Solicitando reenvio de e-mail para ${type} ID: ${id} via PlugNotas`);

        const response = await axios.post(targetUrl, {
            reenvio: true,
            destinatarios: destinatarios || []
        }, {
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': apiKey 
            }
        });

        res.json({ success: true, data: response.data });
    } catch (error: any) {
        console.error('❌ Erro no reenvio de e-mail PlugNotas:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: 'Erro ao reenviar e-mail pela TecnoSpeed', 
            detail: error.response?.data || error.message 
        });
    }
});


// Cache em memória para configurações fiscais de empresas (permite acesso público a PDFs e XMLs)
export const fiscalConfigCache = new Map<string, { config: any; realCompanyId: string; settings?: any; expiresAt: number }>();

// Helper para buscar configuração fiscal da empresa no Supabase
async function getCompanyFiscalConfig(authHeader: string | null, companyId: string) {
    if (!companyId) throw new Error('companyId é obrigatório para obter configuração fiscal.');

    // 🔍 1. Tenta buscar no cache em memória primeiro (bypassa o RLS e Supabase API inteiramente)
    const cached = fiscalConfigCache.get(companyId);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`⚡ [FISCAL-CACHE] Configuração fiscal recuperada do cache para: ${companyId}`);
        return {
            config: cached.config,
            realCompanyId: cached.realCompanyId,
            settings: cached.settings || {}
        };
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase URL ou Anon Key não configurados no servidor.');
    }

    try {
        console.log(`🏢 Buscando config fiscal para empresa via API: ${companyId}`);
        
        // 🔍 Detectar se é um UUID ou CNPJ
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);
        const column = isUUID ? 'id' : 'cnpj';
        const cleanId = isUUID ? companyId : companyId.replace(/\D/g, '');

        const useServiceRole = !authHeader && SUPABASE_SERVICE_ROLE_KEY;
        const headers: any = {
            'apikey': useServiceRole ? SUPABASE_SERVICE_ROLE_KEY : (SUPABASE_ANON_KEY as string)
        };
        if (authHeader) {
            headers['Authorization'] = authHeader;
        } else if (useServiceRole) {
            headers['Authorization'] = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
        }

        let company: any;
        try {
            const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
                params: {
                    [column]: `eq.${cleanId}`,
                    select: 'id,tecnospeed_config,fiscal_module_enabled,settings'
                },
                headers
            });
            company = response.data?.[0];
        } catch (fetchErr: any) {
            console.warn(`⚠️ [FISCAL] Erro ao buscar empresa com token (possivelmente expirado):`, fetchErr.message);
        }

        if (!company && SUPABASE_SERVICE_ROLE_KEY) {
            console.log(`⚠️ Acesso negado com token atual. Tentando via SUPABASE_SERVICE_ROLE_KEY para ${companyId}...`);
            const fallbackResponse = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
                params: {
                    [column]: `eq.${cleanId}`,
                    select: 'id,tecnospeed_config,fiscal_module_enabled,settings'
                },
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                }
            });
            company = fallbackResponse.data?.[0];
        }

        if (!company) {
            // Se falhou e temos um cache expirado, usa como fallback emergencial
            if (cached) {
                console.warn(`⚠️ [FISCAL-CACHE] Falha ao obter dados frescos para ${companyId}. Usando cache expirado de fallback.`);
                return {
                    config: cached.config,
                    realCompanyId: cached.realCompanyId,
                    settings: cached.settings || {}
                };
            }
            throw new Error(`Empresa (${companyId}) não encontrada ou acesso negado no Supabase.`);
        }
        
        if (!company.fiscal_module_enabled) throw new Error('Módulo fiscal não habilitado para esta empresa.');

        const result = {
            config: company.tecnospeed_config || {},
            realCompanyId: company.id,
            settings: company.settings || {}
        };

        // Salvar no cache com 1 dia de expiração (para dar máxima resiliência a cliques de clientes finais no WhatsApp)
        fiscalConfigCache.set(companyId, {
            config: company.tecnospeed_config || {},
            realCompanyId: company.id,
            settings: company.settings || {},
            expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
        });

        // Também indexa pelo ID resolvido para garantir que ambos funcionem no cache (UUID e CNPJ)
        if (company.id !== companyId) {
            fiscalConfigCache.set(company.id, {
                config: company.tecnospeed_config || {},
                realCompanyId: company.id,
                settings: company.settings || {},
                expiresAt: Date.now() + 24 * 60 * 60 * 1000
            });
        }

        return result;
    } catch (error: any) {
        // Fallback emergencial usando o cache mesmo que expirado
        if (cached) {
            console.warn(`⚠️ [FISCAL-CACHE] Erro ao buscar dados frescos para ${companyId}. Usando cache expirado de fallback.`);
            return {
                config: cached.config,
                realCompanyId: cached.realCompanyId,
                settings: cached.settings || {}
            };
        }
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
            currency: 'BRL',
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
    const { instanceName, number, text, mediaUrl, mediaType, mimetype, fileName } = req.body;

    if (!instanceName || !number) {
        return res.status(400).json({ error: 'instanceName e number são obrigatórios' });
    }

    try {
        const targetName = await resolveTargetName(instanceName);
        const encodedName = encodeURIComponent(targetName);

        // Se o link do PDF for local (localhost), a Evolution API na nuvem não conseguirá baixá-lo.
        // Nesse caso, pulamos o envio de mídia e enviamos direto como texto com o link.
        const isLocalhost = mediaUrl && (mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1'));

        if (mediaUrl && !isLocalhost) {
            try {
                console.log(`✉️ [Media] Tentando enviar documento WhatsApp via "${targetName}" para ${number}...`);
                const response = await axios.post(`${EVOLUTION_API_URL}/message/sendMedia/${encodedName}`, {
                    number: number,
                    mediatype: mediaType || 'document',
                    mimetype: mimetype || 'application/pdf',
                    caption: text || '',
                    media: mediaUrl,
                    fileName: fileName || 'NotaFiscal.pdf'
                }, {
                    headers: {
                        'apikey': EVOLUTION_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    timeout: 8000 // 8 segundos de timeout para evitar travamentos
                });
                return res.json(response.data);
            } catch (mediaErr: any) {
                console.warn(`⚠️ Falha ao enviar como mídia (${mediaErr.message || mediaErr}). Fazendo fallback para texto...`);
            }
        }

        // Texto final: se o link for local ou se falhar o envio de mídia, garante que o link vá no texto
        let textToSend = text || '';
        if (mediaUrl && !textToSend.includes(mediaUrl)) {
            textToSend = `${textToSend}\n\nLink do PDF: ${mediaUrl}`.trim();
        }

        if (!textToSend) {
            return res.status(400).json({ error: 'text ou mediaUrl é obrigatório' });
        }

        console.log(`✉️ [Text] Enviando mensagem de texto WhatsApp via "${targetName}" para ${number}...`);
        const response = await axios.post(`${EVOLUTION_API_URL}/message/sendText/${encodedName}`, {
            number: number,
            text: textToSend,
            linkPreview: true
        }, {
            headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        return res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro ao enviar WhatsApp:', JSON.stringify(errorDetail, null, 2));
        res.status(500).json({ error: 'Erro ao enviar mensagem via Evolution API', detail: errorDetail });
    }
});

// --- PUBLIC CAMPAIGN WEBHOOK PROXY ---
app.post('/api/public/campaign-webhook', async (req, res) => {
    const { webhook_url, payload } = req.body;

    if (!webhook_url) {
        return res.status(400).json({ error: 'URL do Webhook obrigatória' });
    }

    // Tenta obter o nome da instância de WhatsApp no Supabase
    let enrichedPayload = { ...payload };
    if (SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY) && payload?.campaign?.whatsapp) {
        const cleanCampaignPhone = payload.campaign.whatsapp.replace(/\D/g, '');
        if (cleanCampaignPhone) {
            try {
                const headers: Record<string, string> = {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!
                };
                if (SUPABASE_SERVICE_ROLE_KEY) {
                    headers['Authorization'] = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
                } else if (SUPABASE_ANON_KEY) {
                    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
                }

                console.log(`🔍 Buscando instâncias no Supabase para corresponder com número de campanha: ${cleanCampaignPhone}...`);
                const dbRes = await axios.get(`${SUPABASE_URL}/rest/v1/instances?select=instance_name,phone_number`, {
                    headers,
                    timeout: 4000
                });

                if (dbRes.data && Array.isArray(dbRes.data)) {
                    console.log(`   [Proxy] Total de instâncias cadastradas encontradas: ${dbRes.data.length}`);
                    const campaignLast8 = cleanCampaignPhone.slice(-8);

                    const matchingInst = dbRes.data.find((inst: any) => {
                        if (!inst.phone_number) return false;
                        const cleanInstPhone = inst.phone_number.replace(/\D/g, '');
                        return cleanInstPhone.slice(-8) === campaignLast8;
                    });

                    if (matchingInst) {
                        const instanceName = matchingInst.instance_name;
                        console.log(`   📱 Match encontrado! Instância: "${instanceName}" para o número ${matchingInst.phone_number}`);
                        enrichedPayload = {
                            ...payload,
                            whatsapp_instance_name: instanceName
                        };
                    } else {
                        console.log(`   ⚠️ Nenhuma instância correspondente aos últimos 8 dígitos (${campaignLast8}) foi encontrada.`);
                    }
                }
            } catch (err: any) {
                console.warn('⚠️ Erro ao buscar nome da instância no Supabase:', err.message);
            }
        }
    }

    try {
        console.log(`📡 Sending campaign webhook via proxy to ${webhook_url}...`);
        
        const response = await axios.post(webhook_url, enrichedPayload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LucroCerto-CampaignWebhook/1.0'
            },
            timeout: 10000 // 10 seconds timeout
        });

        console.log(`✅ Webhook sent successfully! Status: ${response.status}`);
        return res.json({ 
            success: true, 
            status: response.status, 
            data: response.data 
        });
    } catch (error: any) {
        const status = error.response?.status || 500;
        const detail = error.response?.data || error.message;
        console.error('❌ Erro no proxy do webhook da campanha:', error.message);
        return res.status(status).json({ 
            success: false,
            error: 'Erro ao enviar dados para o webhook', 
            message: error.message,
            detail: typeof detail === 'object' ? JSON.stringify(detail) : detail
        });
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
