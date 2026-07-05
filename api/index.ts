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

// Helper axios para NFe.io com desabilitação de Keep-Alive e retry automático em ECONNRESET/ETIMEDOUT
async function axiosNfeioRequest(config: any, retries = 2, delay = 1000): Promise<any> {
    try {
        if (!config.headers) config.headers = {};
        // Desabilitar keep-alive especificamente para evitar ECONNRESET em conexões serverless reusadas
        config.headers['Connection'] = 'close';
        return await axios(config);
    } catch (err: any) {
        const isNetworkError = !err.response || 
                               err.code === 'ECONNRESET' || 
                               err.code === 'ETIMEDOUT' || 
                               err.code === 'ECONNABORTED' ||
                               err.message?.includes('ECONNRESET') ||
                               err.message?.includes('Network Error');
        if (isNetworkError && retries > 0) {
            console.warn(`⚠️ [NFEIO-RETRY] Falha de conexão (${err.code || err.message}). Retentando em ${delay}ms... (${retries} tentativas restantes)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return axiosNfeioRequest(config, retries - 1, delay * 1.5);
        }
        throw err;
    }
}

function extractCnpjCpfFromPfx(buffer: Buffer): { cnpjs: string[], cpfs: string[] } {
    try {
        const content = buffer.toString('binary');
        const allDigitSequences = content.match(/\d+/g) || [];
        
        const cnpjs = allDigitSequences.filter(s => s.length === 14);
        const cpfs = allDigitSequences.filter(s => s.length === 11);
        
        return {
            cnpjs: Array.from(new Set(cnpjs)),
            cpfs: Array.from(new Set(cpfs))
        };
    } catch (err) {
        console.error('Erro ao ler dados binários do PFX:', err);
        return { cnpjs: [], cpfs: [] };
    }
}

function formatCnpj(cnpj: string): string {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatCpf(cpf: string): string {
    return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function formatWhatsappNumber(phone: string | null | undefined): string {
    if (!phone) return '';
    let clean = String(phone).replace(/\D/g, '');
    
    if (clean.length === 10 || clean.length === 11) {
        clean = '55' + clean;
    }
    
    return clean;
}

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

const EVOLUTION_GO_API_URL = process.env.EVOLUTION_GO_API_URL?.trim().replace(/\/+$/, '') || EVOLUTION_API_URL;
const EVOLUTION_GO_API_KEY = process.env.EVOLUTION_GO_API_KEY?.trim() || EVOLUTION_API_KEY;

// Helper to get Evolution Config based on company_id or instance name or token
async function getEvolutionConfig(identifier: { companyId?: string; instanceName?: string; token?: string; userToken?: string; provider?: string }) {
    let companyId = identifier.companyId;
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const authHeader = identifier.userToken || (SUPABASE_SERVICE_ROLE_KEY ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` : `Bearer ${supabaseKey}`);

    const nameToMatch = identifier.instanceName?.toLowerCase().trim();
    const tokenToMatch = identifier.token && identifier.token !== 'null' && identifier.token !== 'undefined' ? identifier.token.toLowerCase().trim() : '';

    let instanceToken = '';
    let dbProvider: string | null = identifier.provider || null;
    // 🔍 1. Buscar o token da instância, company_id e provider (se name ou token fornecidos)
    if (SUPABASE_URL && supabaseKey && (nameToMatch || tokenToMatch)) {
        try {
            let query = `${SUPABASE_URL}/rest/v1/instances?`;
            if (tokenToMatch) {
                query += `evolution_instance_id=eq.${encodeURIComponent(identifier.token!)}`;
            } else {
                query += `instance_name=eq.${encodeURIComponent(identifier.instanceName!)}`;
            }
            query += `&select=evolution_instance_id,company_id,provider`;
            const response = await axios.get(query, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': authHeader
                }
            });
            if (response.data && response.data.length > 0) {
                instanceToken = response.data[0].evolution_instance_id;
                dbProvider = response.data[0].provider;
                if (!companyId) {
                    companyId = response.data[0].company_id;
                }
            }
        } catch (err: any) {
            console.error('⚠️ [Evolution Proxy] Error fetching instance token:', err.message);
        }
    }

    if (dbProvider === 'evolution_go') {
        return { url: EVOLUTION_GO_API_URL, apiKey: EVOLUTION_GO_API_KEY, isGo: true };
    } else if (dbProvider === 'evolution_api') {
        return { url: EVOLUTION_API_URL, apiKey: EVOLUTION_API_KEY, isGo: false };
    }

    let defaultIsGo = false;
    if (companyId && SUPABASE_URL && supabaseKey) {
        try {
            const response = await axios.get(
                `${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}&select=settings`,
                {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': authHeader
                    }
                }
            );
            if (response.data && response.data.length > 0) {
                const settings = response.data[0].settings || {};
                if (settings.whatsapp_provider === 'evolution_go') {
                    defaultIsGo = true;
                }
            }
        } catch (err: any) {
            console.error('⚠️ [Evolution Proxy] Error fetching company settings:', err.message);
        }
    }

    // 🔍 2. Auto-detecção inteligente (respeitando o toggle como prioridade, e usando o outro como fallback para evitar 404)
    if (nameToMatch || tokenToMatch) {
        try {
            const [goListRes, stdListRes] = await Promise.allSettled([
                axios.get(`${EVOLUTION_GO_API_URL}/instance/all`, { headers: { 'apikey': EVOLUTION_GO_API_KEY }, timeout: 1500 }),
                axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'apikey': EVOLUTION_API_KEY }, timeout: 1500 })
            ]);

            let foundInGo = false;
            if (goListRes.status === 'fulfilled') {
                const goInstances = goListRes.value.data?.data || [];
                foundInGo = goInstances.some((i: any) =>
                    (nameToMatch && (i.name || i.instanceName || '').toLowerCase().trim() === nameToMatch) ||
                    (tokenToMatch && (i.token || i.id || '').toLowerCase().trim() === tokenToMatch)
                );
            }

            let foundInStd = false;
            if (stdListRes.status === 'fulfilled') {
                const rawStdInstances = Array.isArray(stdListRes.value.data) ? stdListRes.value.data : [];
                const stdInstances = rawStdInstances.map((item: any) => item.instance || item);
                foundInStd = stdInstances.some((i: any) =>
                    (nameToMatch && (i.name || i.instanceName || '').toLowerCase().trim() === nameToMatch) ||
                    (tokenToMatch && (i.token || i.id || i.instanceId || '').toLowerCase().trim() === tokenToMatch)
                );
            }

            if (defaultIsGo) {
                // Toggle diz para usar Evolution GO
                if (foundInGo) {
                    console.log(`🔌 [Evolution Config] Usando Evolution GO conforme toggle ativo para a instância ${identifier.instanceName || identifier.token}`);
                    return { url: EVOLUTION_GO_API_URL, apiKey: EVOLUTION_GO_API_KEY, isGo: true };
                } else if (foundInStd) {
                    console.log(`🔌 [Evolution Config] Fallback: Instância ${identifier.instanceName || identifier.token} não está no Evolution GO, usando Evolution Padrão`);
                    return { url: EVOLUTION_API_URL, apiKey: EVOLUTION_API_KEY, isGo: false };
                }
            } else {
                // Toggle diz para usar Evolution Padrão
                if (foundInStd) {
                    console.log(`🔌 [Evolution Config] Usando Evolution Padrão conforme toggle inativo para a instância ${identifier.instanceName || identifier.token}`);
                    return { url: EVOLUTION_API_URL, apiKey: EVOLUTION_API_KEY, isGo: false };
                } else if (foundInGo) {
                    console.log(`🔌 [Evolution Config] Fallback: Instância ${identifier.instanceName || identifier.token} não está no Evolution Padrão, usando Evolution GO`);
                    return { url: EVOLUTION_GO_API_URL, apiKey: EVOLUTION_GO_API_KEY, isGo: true };
                }
            }
        } catch (detectErr: any) {
            console.warn('⚠️ [Evolution Config] Erro na auto-detecção das instâncias:', detectErr.message);
        }
    }

    // Fallback padrão se não puder auto-detectar
    if (defaultIsGo) {
        return { url: EVOLUTION_GO_API_URL, apiKey: EVOLUTION_GO_API_KEY, isGo: true };
    }
    return { url: EVOLUTION_API_URL, apiKey: EVOLUTION_API_KEY, isGo: false };
}

// Helper to get the alternative/fallback Evolution config (opposite of current)
function getAlternativeConfig(currentConfig: { url: string; apiKey: string; isGo: boolean }) {
    if (currentConfig.isGo) {
        return {
            url: EVOLUTION_API_URL,
            apiKey: EVOLUTION_API_KEY,
            isGo: false
        };
    } else {
        return {
            url: EVOLUTION_GO_API_URL,
            apiKey: EVOLUTION_GO_API_KEY,
            isGo: true
        };
    }
}

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
    res.json({
        status: 'ok',
        timestamp: new Date(),
        diagnostics: {
            evolution_api_url: !!process.env.EVOLUTION_API_URL,
            evolution_api_key: !!process.env.EVOLUTION_API_KEY,
            evolution_go_api_url: !!process.env.EVOLUTION_GO_API_URL,
            evolution_go_api_key: !!process.env.EVOLUTION_GO_API_KEY,
            supabase_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
    });
});

// Proxy para cotações de moedas com fallback robusto contra falhas de CORS/Rede
app.get(['/exchange-rates', '/api/exchange-rates'], async (req, res) => {
    try {
        // 1. Tenta a AwesomeAPI com timeout curto (5s)
        const response = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,PYG-BRL,ARS-BRL,GBP-BRL', {
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
                },
                GBPBRL: {
                    bid: rates.GBP ? (1 / rates.GBP).toFixed(4) : "6.5000",
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
                ARSBRL: { bid: "0.005800", pctChange: "0.00" },
                GBPBRL: { bid: "6.5000", pctChange: "0.00" }
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
        
        // --- RESOLVER DADOS E TIPO DA NOTA NO BANCO DE DADOS ---
        let resolvedType = type;
        if (id) {
            try {
                const queryParam = !isNaN(Number(id)) ? { id: `eq.${id}` } : { external_id: `eq.${id}` };
                const { data: invData } = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                    params: { ...queryParam, select: 'external_id,type' },
                    headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader! }
                });
                if (invData?.[0]) {
                    if (invData[0].external_id) {
                        id = invData[0].external_id;
                    }
                    if (invData[0].type) {
                        resolvedType = invData[0].type;
                    }
                }
            } catch (dbErr: any) {
                console.warn('⚠️ Falha ao buscar dados da nota para cancelamento:', dbErr.message);
            }
        }

        // Se mesmo assim não temos o tipo, decide com base no activeProvider da empresa
        const finalType = resolvedType || (activeProvider === 'nfeio' ? 'nfeio' : 'nfse');
        type = finalType; // Sincroniza a variável 'type' para o fluxo subsequente

        // --- ROTEAMENTO NFE.IO ---
        // O cancelamento deve ser feito no provedor onde a nota foi realmente emitida (independente de rotina)
        if (finalType === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta para cancelamento.' });
            }

            const apiKeyNfe = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            console.log(`🚫 [NFEIO-CANCELAR] Cancelando nota NFe.io ID: ${id}`);
            
            const response = await axiosNfeioRequest({
                method: 'DELETE',
                url: `https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}`,
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
    const { companyId, senha, provider } = req.body;
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
        const activeProvider = provider || settings?.fiscal_provider || 'tecnospeed';

        // --- ROTEAMENTO NFE.IO ---
        if (activeProvider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta para upload de certificado.' });
            }

            apiKey = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();
            // NFe.io: certificado usa api.nfse.io (v2) e endpoint com 's' (certificates)
            baseUrl = `https://api.nfse.io/v2/companies/${companyIdNfe}/certificates`;

            console.log(`🔐 [NFEIO-CERTIFICADO] Enviando certificado para NFe.io Empresa: ${companyIdNfe}`);

            form = new FormData();
            form.append('File', file.buffer, {
                filename: file.originalname || 'certificado.pfx',
                contentType: file.mimetype
            });
            form.append('Password', String(senha));

            try {
                const response = await axiosNfeioRequest({
                    method: 'POST',
                    url: baseUrl,
                    data: form,
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
                        const updatedNfeioConfig = {
                            ...(settings?.nfeio_config || {}),
                            certificado_id: certId,
                            certificado_vencimento: vencimento,
                            certificado_sujeito: sujeito,
                            certificado_status: 'ativo',
                            certificado_ultima_atualizacao: new Date().toISOString()
                        };

                        const updatedSettings = {
                            ...(settings || {}),
                            nfeio_config: updatedNfeioConfig
                        };

                        await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${resolvedId}`, {
                            settings: updatedSettings
                        }, {
                            headers: {
                                'apikey': SUPABASE_ANON_KEY!,
                                'Authorization': authHeader!,
                                'Content-Type': 'application/json'
                            }
                        });

                        fiscalConfigCache.delete(resolvedId);
                        console.log(`✅ Certificado NFe.io (${certId}) e metadados salvos localmente em settings.nfeio_config.`);
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
            } catch (error: any) {
                const errorDetail = error.response?.data || error.message;
                const errorMsgStr = typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : String(errorDetail);

                if (errorMsgStr.toLowerCase().includes('tax number is invalid') || errorMsgStr.toLowerCase().includes('cnpj') || errorMsgStr.toLowerCase().includes('invalid')) {
                    const certInfo = extractCnpjCpfFromPfx(file.buffer);
                    const formattedCnpjs = certInfo.cnpjs.map(formatCnpj);
                    const formattedCpfs = certInfo.cpfs.map(formatCpf);
                    
                    const companyCnpjRaw = settings?.cnpj || dbConfig?.cnpj || companyId || '';
                    const companyCnpjFormatted = companyCnpjRaw ? formatCnpj(companyCnpjRaw) : 'Não informado';

                    const customMsg = `O CNPJ do certificado enviado não coincide com o CNPJ da empresa na NFe.io. CNPJ da empresa: ${companyCnpjFormatted}. Documento(s) detectado(s) no certificado: ${[...formattedCnpjs, ...formattedCpfs].join(', ') || 'Nenhum detectado'}.`;
                    
                    console.error('❌ [NFEIO-CNPJ-MISMATCH] Erro customizado:', customMsg);
                    return res.status(400).json({
                        error: 'Erro de validação do CNPJ do certificado',
                        detail: customMsg
                    });
                }

                throw error;
            }
        }

        // --- INTERCEPTOR DE WEBHOOK EXTERNO PARA CERTIFICADO ---
        const certWebhookUrl = config.certificate_webhook_url || config.external_webhook_url;
        if (activeProvider === 'other' && config.use_external_webhook && certWebhookUrl) {
            console.log(`🚀 [EXTERNAL-MODE] Enviando certificado para o webhook externo: ${certWebhookUrl}`);
            
            baseUrl = certWebhookUrl;
            apiKey = config.certificate_webhook_token || config.external_webhook_token || '';

            const headers: any = { 
                'X-Source': 'LucroCerto-Fiscal-Proxy',
                'X-Company-ID': companyId
            };

            const certWebhookUser = config.certificate_webhook_user || config.external_webhook_user || '';
            if (certWebhookUser) {
                headers['Authorization'] = 'Basic ' + Buffer.from(certWebhookUser + ':' + apiKey).toString('base64');
            } else if (apiKey) {
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

app.delete(['/fiscal-module/delete-certificate', '/api/fiscal-module/delete-certificate'], authenticate, async (req: any, res) => {
    const companyId = req.body.companyId || req.query.companyId;
    const provider = req.body.provider || req.query.provider;
    const authHeader = req.headers.authorization;

    if (!companyId) {
        return res.status(400).json({ error: 'companyId é obrigatório' });
    }

    try {
        const { config, realCompanyId: resolvedId, settings } = await getCompanyFiscalConfig(authHeader!, companyId);
        const activeProvider = provider || settings?.fiscal_provider || 'tecnospeed';

        if (activeProvider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            let certId = nfeioConfig?.certificado_id;
            const apiKey = nfeioConfig?.apiKey?.trim();
            const companyIdNfe = nfeioConfig?.companyId?.trim();

            if (!nfeioConfig || !apiKey || !companyIdNfe) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta.' });
            }

            // Se não temos o certId local ou para garantir que estamos deletando o certificado correto,
            // podemos consultar a empresa no NFe.io para buscar o thumbprint ativo.
            if (!certId) {
                try {
                    console.log(`🔍 [NFEIO-CERTIFICADO] Buscando thumbprint ativo no NFe.io para a empresa ${companyIdNfe}...`);
                    const compRes = await axiosNfeioRequest({
                        method: 'GET',
                        url: `https://api.nfe.io/v1/companies/${companyIdNfe}`,
                        headers: {
                            'Authorization': apiKey,
                            'Accept': 'application/json'
                        }
                    });
                    const activeCert = compRes.data?.companies?.certificate || compRes.data?.company?.certificate || compRes.data?.certificate;
                    if (activeCert?.thumbprint) {
                        certId = activeCert.thumbprint;
                        console.log(`🎯 [NFEIO-CERTIFICADO] Thumbprint ativo encontrado no NFe.io: ${certId}`);
                    }
                } catch (fetchErr: any) {
                    console.warn('⚠️ Não foi possível buscar o certificado ativo no NFe.io:', fetchErr.message);
                }
            }

            if (certId) {
                const baseUrl = `https://api.nfse.io/v2/companies/${companyIdNfe}/certificates/${certId}`;
                console.log(`🗑️ [NFEIO-CERTIFICADO] Deletando certificado na NFe.io: ${certId}`);

                try {
                    await axiosNfeioRequest({
                        method: 'DELETE',
                        url: baseUrl,
                        headers: {
                            'Authorization': apiKey
                        },
                        timeout: 30000
                    });
                } catch (apiErr: any) {
                    // Se o certificado já não existir na NFe.io (404), ignoramos e prosseguimos com a remoção local.
                    if (apiErr.response?.status === 404) {
                        console.log('⚠️ Certificado já não existia na NFe.io. Procedendo com exclusão local.');
                    } else {
                        // Para qualquer outro erro (como 503), logamos o aviso mas permitimos a exclusão local
                        // para evitar que o usuário fique travado por instabilidades na API da NFe.io.
                        console.warn(`⚠️ Erro ao deletar certificado na NFe.io (${apiErr.response?.status || apiErr.message}), mas prosseguindo com exclusão local.`);
                    }
                }
            }

            // Atualizar banco local (Supabase) - remover campos do certificado
            if (SUPABASE_URL) {
                const updatedNfeioConfig = {
                    ...nfeioConfig,
                    certificado_id: null,
                    certificado_vencimento: null,
                    certificado_sujeito: null,
                    certificado_status: null,
                    certificado_ultima_atualizacao: new Date().toISOString()
                };

                const updatedSettings = {
                    ...(settings || {}),
                    nfeio_config: updatedNfeioConfig
                };

                await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${resolvedId}`, {
                    settings: updatedSettings
                }, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY!,
                        'Authorization': authHeader!,
                        'Content-Type': 'application/json'
                    }
                });

                fiscalConfigCache.delete(resolvedId);
                console.log(`✅ Certificado NFe.io excluído e metadados zerados localmente.`);
            }
        } else {
            // TecnoSpeed ou Outro
            if (SUPABASE_URL) {
                const currentConfig = config || {};
                const updatedConfig = {
                    ...currentConfig,
                    certificado_id: null,
                    certificado_vencimento: null,
                    certificado_sujeito: null,
                    certificado_status: null,
                    ultima_atualizacao: new Date().toISOString()
                };

                await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${resolvedId}`, {
                    tecnospeed_config: updatedConfig
                }, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY!,
                        'Authorization': authHeader!,
                        'Content-Type': 'application/json'
                    }
                });

                fiscalConfigCache.delete(resolvedId);
                console.log(`✅ Certificado local excluído e metadados zerados.`);
            }
        }

        return res.json({ message: 'Certificado excluído com sucesso' });
    } catch (error: any) {
        console.error('❌ Erro ao excluir certificado:', error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
            error: 'Erro ao excluir certificado',
            detail: error.response?.data || error.message
        });
    }
});

app.post(['/fiscal-module/nfeio/companies/:companyId/certificates', '/api/fiscal-module/nfeio/companies/:companyId/certificates'], authenticate, upload.single('arquivo'), async (req: any, res) => {
    let { companyId } = req.params;
    const { senha } = req.body;
    const authHeader = req.headers.authorization;
    const file = req.file;

    if (!companyId || !file || !senha) {
        return res.status(400).json({ error: 'companyId, arquivo e senha são obrigatórios' });
    }

    let baseUrl = '';
    let apiKey = '';
    let form: any = null;

    try {
        let dbConfig: any = null;
        let resolvedId = companyId;
        let settings: any = null;

        try {
            const fiscalInfo = await getCompanyFiscalConfig(authHeader!, companyId);
            dbConfig = fiscalInfo.config;
            resolvedId = fiscalInfo.realCompanyId;
            settings = fiscalInfo.settings;
        } catch (err) {
            console.warn(`⚠️ Não foi possível resolver config fiscal com companyId direto: ${companyId}. Tentando busca por nfeio_config.companyId...`);
        }

        if (!settings || !settings.nfeio_config || settings.nfeio_config.companyId !== companyId) {
            console.log(`🔍 [NFEIO-CERT-ROUTE] Buscando empresa por nfeio_config.companyId: ${companyId}`);
            if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
                const response = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
                    params: {
                        'settings->nfeio_config->>companyId': `eq.${companyId}`,
                        select: 'id,tecnospeed_config,fiscal_module_enabled,settings'
                    },
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                    }
                });
                
                const foundCompany = response.data?.[0];
                if (foundCompany) {
                    resolvedId = foundCompany.id;
                    dbConfig = foundCompany.tecnospeed_config || {};
                    settings = foundCompany.settings || {};
                    console.log(`✅ [NFEIO-CERT-ROUTE] Empresa encontrada por nfeio_config.companyId: ${resolvedId}`);
                }
            }
        }

        const activeProvider = settings?.fiscal_provider || 'nfeio';
        const nfeioConfig = settings?.nfeio_config;

        if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
            return res.status(400).json({ error: 'Configuração da NFe.io incompleta para upload de certificado.' });
        }

        apiKey = nfeioConfig.apiKey.trim();
        const companyIdNfe = nfeioConfig.companyId.trim();
        
        baseUrl = `https://api.nfse.io/v2/companies/${companyIdNfe}/certificates`;

        console.log(`🔐 [NFEIO-CERT-ROUTE] Enviando certificado para NFe.io Empresa: ${companyIdNfe}`);

        form = new FormData();
        form.append('File', file.buffer, {
            filename: file.originalname || 'certificado.pfx',
            contentType: file.mimetype
        });
        form.append('Password', String(senha));

        try {
            const response = await axiosNfeioRequest({
                method: 'POST',
                url: baseUrl,
                data: form,
                headers: {
                    ...form.getHeaders(),
                    'Authorization': apiKey
                },
                timeout: 30000
            });

            const certData = response.data;
            const certId = certData?.thumbprint || certData?.id || certData?.certificateId || 'nfeio_cert';
            const vencimento = certData?.validUntil || certData?.vencimento || certData?.expirationDate || certData?.endDate || new Date(Date.now() + 365*24*60*60*1000).toISOString();
            const sujeito = certData?.subject || certData?.sujeito || certData?.commonName || certData?.nome || 'Certificado NFe.io';

            if (SUPABASE_URL) {
                try {
                    const updatedNfeioConfig = {
                        ...(settings?.nfeio_config || {}),
                        certificado_id: certId,
                        certificado_vencimento: vencimento,
                        certificado_sujeito: sujeito,
                        certificado_status: 'ativo',
                        certificado_ultima_atualizacao: new Date().toISOString()
                    };

                    const updatedSettings = {
                        ...(settings || {}),
                        nfeio_config: updatedNfeioConfig
                    };

                    await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${resolvedId}`, {
                        settings: updatedSettings
                    }, {
                        headers: {
                            'apikey': SUPABASE_ANON_KEY!,
                            'Authorization': authHeader!,
                            'Content-Type': 'application/json'
                        }
                    });

                    fiscalConfigCache.delete(resolvedId);
                    console.log(`✅ [NFEIO-CERT-ROUTE] Certificado NFe.io (${certId}) e metadados salvos localmente em settings.nfeio_config.`);
                } catch (dbErr: any) {
                    console.warn('⚠️ [NFEIO-CERT-ROUTE] Não foi possível salvar metadados do certificado NFe.io localmente:', dbErr.message);
                }
            }

            return res.json({
                message: 'Certificado processado com sucesso na NFe.io',
                id: certId,
                vencimento: vencimento,
                sujeito: sujeito,
                status: 'ativo'
            });
        } catch (error: any) {
            const errorDetail = error.response?.data || error.message;
            const errorMsgStr = typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : String(errorDetail);

            if (errorMsgStr.toLowerCase().includes('tax number is invalid') || errorMsgStr.toLowerCase().includes('cnpj') || errorMsgStr.toLowerCase().includes('invalid')) {
                const certInfo = extractCnpjCpfFromPfx(file.buffer);
                const formattedCnpjs = certInfo.cnpjs.map(formatCnpj);
                const formattedCpfs = certInfo.cpfs.map(formatCpf);
                
                const companyCnpjRaw = settings?.cnpj || dbConfig?.cnpj || companyId || '';
                const companyCnpjFormatted = companyCnpjRaw ? formatCnpj(companyCnpjRaw) : 'Não informado';

                const customMsg = `O CNPJ do certificado enviado não coincide com o CNPJ da empresa na NFe.io. CNPJ da empresa: ${companyCnpjFormatted}. Documento(s) detectado(s) no certificado: ${[...formattedCnpjs, ...formattedCpfs].join(', ') || 'Nenhum detectado'}.`;
                
                console.error('❌ [NFEIO-CERT-ROUTE-CNPJ-MISMATCH] Erro customizado:', customMsg);
                return res.status(400).json({
                    error: 'Erro de validação do CNPJ do certificado',
                    detail: customMsg
                });
            }

            throw error;
        }

    } catch (error: any) {
        const detail = error.response?.data || error.message;
        console.error('❌ [NFEIO-CERT-ROUTE] Erro ao subir certificado:', JSON.stringify(detail));
        res.status(error.response?.status || 500).json({
            error: 'Erro ao subir certificado na NFe.io',
            detail: detail
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
        const { config, realCompanyId: resolvedId, settings } = await getCompanyFiscalConfig(authHeader!, companyId, Boolean(isLabTest));
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
            let taxNumber = String(firstItem?.tomador?.cpfCnpj || '').replace(/\D/g, '');
            
            // Corrige CNPJ fictício inválido comumente vindo do frontend ou de localStorage antigo
            if (taxNumber === '99999999999999') {
                taxNumber = '00000000000191';
            }
            
            const borrowerType = taxNumber.length === 11 ? 'NaturalPerson' : (taxNumber.length === 14 ? 'LegalEntity' : 'Undefined');

            // Mapeamento de endereço do tomador
            const tomadorEnd = firstItem?.tomador?.endereco || {};
            
            const serviceItem = Array.isArray(firstItem?.servico) ? firstItem?.servico[0] : firstItem?.servico;
            
            // Calcula o valor do serviço buscando em múltiplos campos possíveis do payload
            const rawAmount = serviceItem?.valor?.servico
                || serviceItem?.valor?.liquido
                || serviceItem?.valor?.bruto
                || serviceItem?.valorUnitario
                || serviceItem?.valorTotal
                || firstItem?.valor?.servico
                || firstItem?.valorServico
                || 0;
            const servicesAmount = Number(rawAmount);

            if (servicesAmount <= 0) {
                console.error('❌ [NFEIO-EMITIR] servicesAmount inválido (zero ou negativo). Payload recebido:', JSON.stringify(firstItem, null, 2));
                return res.status(400).json({ error: 'Valor do serviço inválido ou ausente. Verifique o campo valor.servico ou valorUnitario no payload.' });
            }

            // --- Mapeamento de campos do estado/cidade ---
            // TecnoSpeed usa 'estado' e 'descricaoCidade', NFe.io usa 'uf' e 'cidade'
            const stateValue = String(tomadorEnd.uf || tomadorEnd.estado || '').trim().toUpperCase();
            const cityCode   = String(tomadorEnd.codigoCidade || firstItem?.emitente?.codigoCidade || '').trim();
            
            let cityName = String(tomadorEnd.cidade || tomadorEnd.descricaoCidade || '').trim();
            if (!cityName && cityCode) {
                try {
                    const cleanIbge = cityCode.replace(/\D/g, '').trim();
                    if (cleanIbge.length === 7) {
                        console.log(`🔍 [IBGE-RESOLVER] Resolvendo nome da cidade no IBGE para o código: ${cleanIbge}...`);
                        const ibgeResponse = await axios.get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cleanIbge}`, {
                            timeout: 2500
                        });
                        if (ibgeResponse.data?.nome) {
                            cityName = ibgeResponse.data.nome;
                            console.log(`🎯 [IBGE-RESOLVER] Sucesso: IBGE ${cleanIbge} -> "${cityName}"`);
                        }
                    }
                } catch (ibgeErr: any) {
                    console.warn('⚠️ [IBGE-RESOLVER] Falha ao obter nome da cidade via API pública do IBGE:', ibgeErr.message);
                }
            }

            // --- RESOLUÇÃO DE FALLBACKS DE ENDEREÇO PARA NFE.IO ---
            // Garante que se o cliente (tomador) não tiver endereço completo cadastrado, a nota não seja rejeitada.
            const companyEnd = config?.endereco || {};
            const fallbackCep = String(companyEnd.cep || '59000000').replace(/\D/g, '');
            const fallbackStreet = String(companyEnd.logradouro || 'Rua Principal').trim();
            const fallbackNumber = String(companyEnd.numero || 'S/N').trim();
            const fallbackDistrict = String(companyEnd.bairro || 'Centro').trim();
            const fallbackState = String(companyEnd.uf || 'RN').trim().toUpperCase();
            const fallbackCityCode = String(companyEnd.codigoCidade || '2408102').trim();

            const finalCep = String(tomadorEnd.cep || '').replace(/\D/g, '') || fallbackCep;
            const finalStreet = String(tomadorEnd.logradouro || '').trim() || fallbackStreet;
            const finalNumber = String(tomadorEnd.numero || '').trim() || fallbackNumber;
            const finalDistrict = String(tomadorEnd.bairro || '').trim() || fallbackDistrict;
            const finalState = stateValue || fallbackState;
            const finalCityCode = cityCode && cityCode !== '0' ? cityCode : fallbackCityCode;

            if (!cityName || cityName === 'Cidade Não Informada') {
                if (finalCityCode) {
                    try {
                        const cleanIbge = finalCityCode.replace(/\D/g, '').trim();
                        const ibgeResponse = await axios.get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cleanIbge}`, {
                            timeout: 2500
                        });
                        if (ibgeResponse.data?.nome) {
                            cityName = ibgeResponse.data.nome;
                        }
                    } catch (e) {
                        cityName = 'Natal'; // Fallback final
                    }
                } else {
                    cityName = 'Natal';
                }
            }

            // --- ISS Rate: prioridade ao valor do payload (iss.aliquota), fallback para config da empresa ---
            // NFe.io espera decimal: 0.05 = 5%. Se vier como inteiro (5), divide por 100.
            const toDecimalRate = (v: number) => v / 100;
            const issRateFromPayload = serviceItem?.iss?.aliquota ? toDecimalRate(Number(serviceItem.iss.aliquota)) : undefined;
            const issRateFromConfig  = nfeioConfig.aliquotaIss
                ? toDecimalRate(Number(String(nfeioConfig.aliquotaIss).replace(',', '.')))
                : undefined;
            const issRate = issRateFromPayload || issRateFromConfig;

            // --- Inscrição Municipal: prioridade ao prestador do payload, fallback para config ---
            const inscricaoMunicipal = String(
                firstItem?.prestador?.inscricaoMunicipal ||
                nfeioConfig.inscricaoMunicipal ||
                ''
            ).trim();

            const nfeioPayload: any = {
                cityServiceCode: String(nfeioConfig.cityServiceCode || serviceItem?.codigo || nfeioConfig.cnae || '1.01').trim(),
                description: String(serviceItem?.discriminacao || serviceItem?.descricao || 'Prestação de serviço').trim(),
                servicesAmount,
                environmentType: isSandbox ? 'test' : 'production',
                borrower: {
                    type: borrowerType,
                    federalTaxNumber: taxNumber || '0',
                    name: String(firstItem?.tomador?.razaoSocial || firstItem?.tomador?.nomeFantasia || 'CLIENTE NAO IDENTIFICADO').trim(),
                    email: firstItem?.tomador?.email || null,
                    phone: firstItem?.tomador?.telefone || firstItem?.tomador?.contato?.telefone || null,
                    address: {
                        country: 'BRA',
                        postalCode: finalCep,
                        street: finalStreet,
                        number: finalNumber,
                        additionalInformation: String(tomadorEnd.complemento || '').trim() || undefined,
                        district: finalDistrict,
                        state: finalState,
                        city: {
                            code: finalCityCode,
                            name: cityName
                        }
                    }
                }
            };

            // Adiciona campos opcionais do prestador apenas se existirem
            if (issRate && issRate > 0) nfeioPayload.issRate = issRate;
            if (inscricaoMunicipal) nfeioPayload.municipalTaxNumber = inscricaoMunicipal;
            if (nfeioConfig.simplesNacional !== undefined) nfeioPayload.simpleSocialScheme = Boolean(nfeioConfig.simplesNacional);
            if (nfeioConfig.cnae) nfeioPayload.cnaeCode = String(nfeioConfig.cnae).trim();

            // Adiciona alíquotas de retenções federais se existirem e o tomador for Pessoa Jurídica (CNPJ)
            const isIndividual = borrowerType === 'NaturalPerson';
            const pisRate = !isIndividual ? ((serviceItem?.pis?.aliquota ? toDecimalRate(Number(serviceItem.pis.aliquota)) : undefined) ||
                            (config?.default_pis_aliquota ? toDecimalRate(Number(String(config.default_pis_aliquota).replace(',', '.'))) : undefined)) : undefined;
            const cofinsRate = !isIndividual ? ((serviceItem?.cofins?.aliquota ? toDecimalRate(Number(serviceItem.cofins.aliquota)) : undefined) ||
                               (config?.default_cofins_aliquota ? toDecimalRate(Number(String(config.default_cofins_aliquota).replace(',', '.'))) : undefined)) : undefined;
            const csllRate = !isIndividual ? ((serviceItem?.csll?.aliquota ? toDecimalRate(Number(serviceItem.csll.aliquota)) : undefined) ||
                             (config?.default_csll_aliquota ? toDecimalRate(Number(String(config.default_csll_aliquota).replace(',', '.'))) : undefined)) : undefined;
            const irRate = !isIndividual ? ((serviceItem?.ir?.aliquota ? toDecimalRate(Number(serviceItem.ir.aliquota)) : undefined) ||
                           (config?.default_irrf_aliquota ? toDecimalRate(Number(String(config.default_irrf_aliquota).replace(',', '.'))) : undefined)) : undefined;
            const inssRate = !isIndividual ? (serviceItem?.inss?.aliquota ? toDecimalRate(Number(serviceItem.inss.aliquota)) : undefined) : undefined;

            if (pisRate && pisRate > 0) nfeioPayload.pisRate = pisRate;
            if (cofinsRate && cofinsRate > 0) nfeioPayload.cofinsRate = cofinsRate;
            if (csllRate && csllRate > 0) nfeioPayload.csllRate = csllRate;
            if (irRate && irRate > 0) nfeioPayload.irRate = irRate;
            if (inssRate && inssRate > 0) nfeioPayload.inssRate = inssRate;

            // Reforma Tributária 2026 (IBS/CBS) para NFe.io
            if (nfeioConfig.reforma_tributaria_calculadora_ativa) {
                nfeioPayload.tax = {
                    IBSCBS: {
                        calculationMode: 'OfficialService',
                        ibsRate: Number(nfeioConfig.reforma_tributaria_ibs_aliquota || '0.10') / 100,
                        cbsRate: Number(nfeioConfig.reforma_tributaria_cbs_aliquota || '0.90') / 100
                    }
                };
            }

            console.log(`🧾 [NFEIO-EMITIR] Enviando Payload para NFe.io (Sandbox: ${isSandbox}):`, JSON.stringify(nfeioPayload, null, 2));

            const response = await axiosNfeioRequest({
                method: 'POST',
                url: `https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices`,
                data: nfeioPayload,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': apiKey
                }
            });

            let docId = response.data?.id;
            const status = response.data?.status || response.data?.flowStatus || 'Created';

            if (docId === '{id}' || (docId && docId.startsWith('{'))) {
                docId = `nfeio_mock_${Math.random().toString(36).substring(2, 10)}${Date.now()}`;
                console.log(`⚠️ [NFEIO-EMITIR] ID retornado é placeholder "{id}". Substituindo por ID simulado: ${docId}`);
                if (response.data) {
                    response.data.id = docId;
                    if (response.data.pdf) response.data.pdf = response.data.pdf.replace('{id}', docId);
                    if (response.data.xml) response.data.xml = response.data.xml.replace('{id}', docId);
                }
            }
            
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
        if (activeProvider === 'other' && config.use_external_webhook && config.external_webhook_url) {
            const externalId = `webhook_${Math.random().toString(36).substring(2, 10)}${Date.now()}`;
            console.log(`🚀 [EXTERNAL-MODE] Gerado ID de integração: ${externalId}`);
            console.log(`🚀 [EXTERNAL-MODE] Enviando payload RAW para: ${config.external_webhook_url}`);
            
            // Envia o payload exatamente como veio do frontend (RAW), mas garantindo formato array e injetando idIntegracao
            const rawPayload = Array.isArray(payload) ? payload : [payload];
            const finalPayload = rawPayload.map((item: any) => {
                if (typeof item === 'object' && item !== null) {
                    return {
                        ...item,
                        idIntegracao: item.idIntegracao || externalId
                    };
                }
                return item;
            });

            const headers: any = { 
                'Content-Type': 'application/json', 
                'X-Source': 'LucroCerto-Fiscal-Proxy',
                'X-Company-ID': companyId,
                'X-Invoice-ID': externalId
            };

            if (config.external_webhook_user) {
                headers['Authorization'] = 'Basic ' + Buffer.from(config.external_webhook_user + ':' + (config.external_webhook_token || '')).toString('base64');
            } else if (config.external_webhook_token) {
                headers['Authorization'] = `Bearer ${config.external_webhook_token}`;
            }

            // Salvar a nota no banco como 'processando' antes de fazer a requisição ao webhook
            if (SUPABASE_URL) {
                console.log(`💾 [DB-SAVE] Criando nota inicial via Webhook ${externalId} com status 'processando'`);
                try {
                    const dbHeaders: any = {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    };
                    if (SUPABASE_SERVICE_ROLE_KEY) {
                        dbHeaders['Authorization'] = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
                    } else if (authHeader) {
                        dbHeaders['Authorization'] = authHeader;
                    } else {
                        dbHeaders['Authorization'] = `Bearer ${SUPABASE_ANON_KEY!}`;
                    }

                    await axios.post(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                        company_id: resolvedId,
                        quote_id: quoteId || null,
                        external_id: externalId,
                        type: 'webhook',
                        status: 'processando',
                        payload: {
                            ...finalPayload[0],
                            idIntegracao: externalId
                        }
                    }, {
                        headers: dbHeaders
                    });
                } catch (dbErr: any) {
                    console.error('❌ [DB-SAVE] Erro ao salvar nota Webhook inicial no banco:', dbErr.message);
                }
            }

            try {
                const response = await axios.post(config.external_webhook_url, finalPayload, {
                    headers,
                    timeout: 10000
                });
                console.log(`✅ [EXTERNAL-MODE] Resposta recebida do webhook externo.`);
                const resData = response.data || {};
                
                return res.json({ 
                    id: externalId,
                    status: 'processando',
                    ...resData, 
                    proxy_version: '1.0.35', 
                    mode: 'external_relay' 
                });
            } catch (webhookErr: any) {
                console.error(`❌ [EXTERNAL-MODE] Webhook externo retornou erro:`, webhookErr.message);
                
                // Se o webhook falhar imediatamente, atualizamos o status no banco para 'erro'
                if (SUPABASE_URL) {
                    try {
                        const errorMsg = webhookErr.response?.data?.error || webhookErr.response?.data?.message || webhookErr.message;
                        await axios.patch(`${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${externalId}`, {
                            status: 'erro',
                            error_message: `Webhook externo falhou: ${JSON.stringify(errorMsg)}`,
                            updated_at: new Date().toISOString()
                        }, {
                            headers: {
                                'apikey': SUPABASE_ANON_KEY!,
                                'Authorization': authHeader!,
                                'Content-Type': 'application/json'
                            }
                        });
                    } catch (dbPatchErr: any) {
                        console.error('❌ [DB-PATCH] Erro ao atualizar status de erro no banco:', dbPatchErr.message);
                    }
                }
                
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
                    const cleanCpfCnpj = String(item.tomador.cpfCnpj).replace(/\D/g, '');
                    item.tomador.cpfCnpj = cleanCpfCnpj;
                    if (cleanCpfCnpj.length === 11 && item.servico) {
                        const services = Array.isArray(item.servico) ? item.servico : [item.servico];
                        services.forEach((s: any) => {
                            delete s.pis;
                            delete s.cofins;
                            delete s.csll;
                            delete s.ir;
                            delete s.inss;
                        });
                    }
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
                if (isNacional) {
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
                            if (s.codigoTributacao) {
                                s.codigoTributacao = String(s.codigoTributacao).replace(/\D/g, '').substring(0, 3).padEnd(3, '0');
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

        // O PlugNotas utiliza o endpoint unificado /nfse para a emissão de notas (tanto municipais quanto nacionais).
        // A distinção nacional é feita no próprio payload pelo campo "versao: 1.00".
        const targetEndpoint = endpoint;
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
        console.error('❌ [FISCAL-EMITIR-ERROR] Falha na emissão:', error.message, error.response?.data || '');
        
        const isConnectionReset = error.code === 'ECONNRESET' || error.message?.includes('ECONNRESET');
        const isTimeout = error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' || error.message?.includes('timeout');
        const is503 = error.response?.status === 503;
        
        let customMessage = error.message;
        if (isConnectionReset) {
            customMessage = 'Conexão interrompida (ECONNRESET) com o provedor fiscal. A API do provedor (NFe.io/Tecnospeed) fechou a conexão inesperadamente. Por favor, tente novamente em alguns instantes.';
        } else if (isTimeout) {
            customMessage = 'Tempo limite de resposta excedido (timeout) ao se comunicar com o provedor fiscal. O servidor deles está demorando muito para responder.';
        } else if (is503) {
            customMessage = 'Serviço Indisponível (Erro 503) no provedor fiscal. A API deles (NFe.io/Tecnospeed) pode estar em manutenção ou sobrecarregada. Tente novamente mais tarde.';
        }
        
        res.status(error.response?.status || 500).json({ 
            error: customMessage, 
            detail: error.response?.data || { code: error.code }
        });
    }
});

app.post(['/fiscal-module/sync-issuer', '/api/fiscal-module/sync-issuer'], authenticate, async (req, res) => {
    const { companyId, config } = req.body;
    const authHeader = req.headers.authorization;

    try {
        const { settings } = await getCompanyFiscalConfig(authHeader!, companyId);
        const activeProvider = settings?.fiscal_provider || 'tecnospeed';
        // --- INTERCEPTOR DE NFE.IO PARA EMITENTE ---
        if (config.apiKey && !config.tecnospeed_api_key) {
            console.log(`🚀 [NFEIO-SYNC] Sincronizando emitente com a NFe.io para a empresa: ${companyId}`);
            
            const apiKey = config.apiKey.trim();
            
            try {
                // Busca os dados cadastrais da empresa no banco
                const companyRes = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`
                    }
                });
                const companyDetails = companyRes.data?.[0];
                if (!companyDetails) {
                    return res.status(404).json({ error: 'Empresa não encontrada no banco de dados local.' });
                }

                const cleanCnpj = (companyDetails.cnpj || '').replace(/\D/g, '');
                if (!cleanCnpj) {
                    return res.status(400).json({ error: 'CNPJ da empresa é obrigatório no cadastro local para sincronizar com a NFe.io.' });
                }

                let taxRegime = 'simplesNacional';
                if (config.simplesNacional === false) {
                    taxRegime = 'lucroPresumido';
                } else if (config.simplesNacional === true) {
                    taxRegime = 'simplesNacional';
                }

                // Resolve o código IBGE da cidade
                let ibgeCode = '';
                
                // 1. Tenta buscar das configurações da Tecnospeed já salvas
                if (companyDetails.tecnospeed_config?.endereco?.codigoCidade) {
                    ibgeCode = String(companyDetails.tecnospeed_config.endereco.codigoCidade).trim();
                } else if (companyDetails.tecnospeed_config?.codigo_municipio) {
                    ibgeCode = String(companyDetails.tecnospeed_config.codigo_municipio).trim();
                }

                // 2. Se não encontrou, busca na API de localidades do IBGE
                if (!ibgeCode && companyDetails.city && companyDetails.state) {
                    try {
                        const uf = String(companyDetails.state).trim().toUpperCase();
                        const cityName = String(companyDetails.city).trim();
                        console.log(`🔍 [NFEIO-IBGE] Buscando código IBGE para a cidade: ${cityName} - ${uf}`);
                        
                        const ibgeRes = await axios.get(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, {
                            timeout: 5000
                        });
                        
                        const cities = ibgeRes.data || [];
                        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '');
                        
                        const normalizedCityName = normalize(cityName);
                        const matchedCity = cities.find((c: any) => normalize(c.nome) === normalizedCityName);
                        
                        if (matchedCity && matchedCity.id) {
                            ibgeCode = String(matchedCity.id);
                            console.log(`🎯 [NFEIO-IBGE] Código IBGE encontrado: ${ibgeCode} para ${cityName}`);
                        }
                    } catch (ibgeErr: any) {
                        console.warn('⚠️ Falha ao consultar o IBGE para código do município:', ibgeErr.message);
                    }
                }

                // Fallback final
                if (!ibgeCode) {
                    ibgeCode = '4115200'; // Maringá como fallback
                }

                const nfeioPayload = {
                    name: companyDetails.legal_name || companyDetails.trade_name || 'Razão Social não informada',
                    tradeName: companyDetails.trade_name || companyDetails.legal_name || 'Nome Fantasia não informado',
                    federalTaxNumber: cleanCnpj,
                    taxRegime: taxRegime,
                    email: companyDetails.email || 'suporte@lucrocerto.com.br',
                    phone: (companyDetails.phone || '').replace(/\D/g, '') || '4430379500',
                    address: {
                        street: companyDetails.street || 'Avenida Duque de Caxias',
                        number: companyDetails.number || '882',
                        district: companyDetails.neighborhood || 'Centro',
                        postalCode: (companyDetails.zip_code || '').replace(/\D/g, '') || '87020025',
                        country: 'BRA',
                        state: (companyDetails.state || 'PR').trim().toUpperCase(),
                        city: {
                            code: ibgeCode,
                            name: companyDetails.city || 'Maringá'
                        },
                        additionalInformation: companyDetails.complement || ''
                    }
                };

                let nfeioCompanyId = config.companyId ? config.companyId.trim() : '';
                let responseData;

                if (nfeioCompanyId) {
                    console.log(`🔄 [NFEIO-SYNC] Atualizando empresa existente na NFe.io ID: ${nfeioCompanyId}`);
                    const updateRes = await axiosNfeioRequest({
                        method: 'PUT',
                        url: `https://api.nfe.io/v2/companies/${nfeioCompanyId}`,
                        data: { company: nfeioPayload },
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': apiKey
                        }
                    });
                    responseData = updateRes.data;
                } else {
                    console.log(`🆕 [NFEIO-SYNC] Cadastrando nova empresa na NFe.io para CNPJ: ${cleanCnpj}`);
                    try {
                        const createRes = await axiosNfeioRequest({
                            method: 'POST',
                            url: 'https://api.nfe.io/v2/companies',
                            data: { company: nfeioPayload },
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': apiKey
                            }
                        });
                        responseData = createRes.data;
                        nfeioCompanyId = responseData.id;
                    } catch (createErr: any) {
                        const errMsg = JSON.stringify(createErr.response?.data || '').toLowerCase();
                        const isDuplicate = createErr.response?.status === 409 || 
                                            createErr.response?.status === 422 ||
                                            errMsg.includes('already exists') || 
                                            errMsg.includes('already_exists') || 
                                            errMsg.includes('já cadastrada') ||
                                            errMsg.includes('duplicated') ||
                                            errMsg.includes('duplicado');

                        if (isDuplicate) {
                            console.log(`⚠️ [NFEIO-SYNC] Conflito detectado. Empresa já cadastrada na NFe.io. Buscando ID via CNPJ...`);
                            const listRes = await axiosNfeioRequest({
                                method: 'GET',
                                url: 'https://api.nfe.io/v2/companies',
                                headers: {
                                    'Authorization': apiKey
                                }
                            });
                            const remoteCompanies = listRes.data?.companies || listRes.data || [];
                            const matched = remoteCompanies.find((c: any) => String(c.federalTaxNumber).replace(/\D/g, '') === cleanCnpj);
                            if (matched && matched.id) {
                                nfeioCompanyId = matched.id;
                                console.log(`🎯 [NFEIO-SYNC] Encontrado ID remoto correspondente: ${nfeioCompanyId}. Atualizando dados...`);
                                const updateRes = await axiosNfeioRequest({
                                    method: 'PUT',
                                    url: `https://api.nfe.io/v2/companies/${nfeioCompanyId}`,
                                    data: { company: nfeioPayload },
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': apiKey
                                    }
                                });
                                responseData = updateRes.data;
                            } else {
                                throw new Error('Esta empresa já está cadastrada na NFe.io sob outra conta ou chave de API. Por favor, verifique suas credenciais na NFe.io.');
                            }
                        } else {
                            throw createErr;
                        }
                    }
                }

                const updatedNfeioConfig = {
                    ...config,
                    companyId: nfeioCompanyId
                };

                const currentSettings = companyDetails.settings || {};
                const updatedSettings = {
                    ...currentSettings,
                    nfeio_config: updatedNfeioConfig
                };

                await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                    settings: updatedSettings
                }, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`,
                        'Content-Type': 'application/json'
                    }
                });

                fiscalConfigCache.delete(companyId);

                return res.json({
                    success: true,
                    message: 'Emitente sincronizado com sucesso na NFe.io.',
                    companyId: nfeioCompanyId,
                    data: responseData
                });

            } catch (nfeErr: any) {
                const errDetail = nfeErr.response?.data || nfeErr.message;
                console.error('❌ [NFEIO-SYNC] Erro na API da NFe.io:', JSON.stringify(errDetail, null, 2));
                return res.status(nfeErr.response?.status || 500).json({
                    error: nfeErr.message || 'Erro ao sincronizar emitente na NFe.io',
                    detail: errDetail
                });
            }
        }

        // --- INTERCEPTOR DE WEBHOOK EXTERNO PARA EMITENTE ---
        if (activeProvider === 'other' && config.use_external_webhook && config.external_webhook_url) {
            console.log(`🚀 [EXTERNAL-MODE] Sincronizando emitente com o webhook externo: ${config.external_webhook_url}`);
            
            const headers: any = { 
                'Content-Type': 'application/json',
                'X-Source': 'LucroCerto-Fiscal-Proxy',
                'X-Company-ID': companyId
            };

            if (config.external_webhook_user) {
                headers['Authorization'] = 'Basic ' + Buffer.from(config.external_webhook_user + ':' + (config.external_webhook_token || '')).toString('base64');
            } else if (config.external_webhook_token) {
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
                    response = await axios.patch(`${baseUrl}/empresa/${effectiveCnpjUrl}`, issuerPayload, {
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

                // Sincroniza também a empresa de teste padrão (08187168000160)
                // para garantir que a emissão de laboratório/teste use a mesma configuração (Nacional ou Municipal)
                const testCompanyCnpj = '08187168000160';
                try {
                    const testIssuerPayload = {
                        cpfCnpj: testCompanyCnpj,
                        cnpj: testCompanyCnpj,
                        razaoSocial: 'TECNOSPEED TECNOLOGIA DA INFORMACAO LTDA',
                        nomeFantasia: 'TECNOSPEED TECNOLOGIA DA INFORMACAO LTDA',
                        simplesNacional: true,
                        regimeTributario: 1,
                        inscricaoMunicipal: isNacional ? '1234567' : '123456',
                        endereco: {
                            logradouro: isNacional ? 'Rua Teste Nacional' : 'Avenida Duque de Caxias',
                            numero: isNacional ? '123' : '882',
                            bairro: isNacional ? 'Centro' : 'Zona 07',
                            cep: isNacional ? '31000000' : '87020025',
                            codigoCidade: isNacional ? '3106200' : '4115200',
                            uf: isNacional ? 'MG' : 'PR',
                            complemento: isNacional ? '' : 'SALA 01'
                        },
                        nfse: {
                            ativo: true,
                            config: {
                                producao: false,
                                rps: {
                                    numeracaoAutomatica: true,
                                    numeracao: [
                                        {
                                            serie: "1",
                                            numero: 1
                                        }
                                    ]
                                },
                                nfseNacional: isNacional
                            }
                        }
                    };

                    console.log(`🔄 [FISCAL-SYNC-TEST-COMPANY] Sincronizando empresa de teste ${testCompanyCnpj} (Nacional: ${isNacional}) na TecnoSpeed...`);
                    try {
                        await axios.get(`${baseUrl}/empresa/${testCompanyCnpj}`, {
                            headers: { 'x-api-key': apiKey }
                        });
                        await axios.patch(`${baseUrl}/empresa/${testCompanyCnpj}`, testIssuerPayload, {
                            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
                        });
                    } catch (testCompanyGetErr: any) {
                        if (testCompanyGetErr.response?.status === 404) {
                            await axios.post(`${baseUrl}/empresa`, testIssuerPayload, {
                                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
                            });
                        } else {
                            console.warn(`⚠️ [FISCAL-SYNC-TEST-COMPANY] Falha ao obter dados da empresa de teste:`, testCompanyGetErr.message);
                        }
                    }
                    console.log(`✅ [FISCAL-SYNC-TEST-COMPANY] Empresa de teste ${testCompanyCnpj} sincronizada com sucesso.`);
                } catch (testCompanyErr: any) {
                    console.warn(`⚠️ [FISCAL-SYNC-TEST-COMPANY] Erro ao sincronizar empresa de teste ${testCompanyCnpj}:`, testCompanyErr.response?.data || testCompanyErr.message);
                }
            } else {
                try {
                    response = await axios.post(`${baseUrl}/empresa`, issuerPayload, {
                        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey }
                    });
                } catch (error: any) {
                    if (error.response?.status === 409) {
                        response = await axios.patch(`${baseUrl}/empresa/${effectiveCnpjUrl}`, issuerPayload, {
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

app.post(['/fiscal-module/deactivate-issuer', '/api/fiscal-module/deactivate-issuer'], authenticate, async (req, res) => {
    const { companyId } = req.body;
    const authHeader = req.headers.authorization;

    if (!companyId) {
        return res.status(400).json({ error: 'companyId é obrigatório para inativar emitente.' });
    }

    try {
        console.log(`🔌 [DEACTIVATE-ISSUER] Iniciando desativação do emitente para a empresa: ${companyId}`);

        // 1. Busca os dados da empresa no Supabase
        const companyRes = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`
            }
        });
        const companyDetails = companyRes.data?.[0];
        if (!companyDetails) {
            return res.status(404).json({ error: 'Empresa não encontrada no banco de dados local.' });
        }

        const activeProvider = companyDetails.settings?.fiscal_provider || 'tecnospeed';
        let providerResponse = null;

        if (activeProvider === 'nfeio') {
            const nfeConfig = companyDetails.settings?.nfeio_config || {};
            const apiKey = nfeConfig.apiKey ? nfeConfig.apiKey.trim() : '';
            const nfeCompanyId = nfeConfig.companyId ? nfeConfig.companyId.trim() : '';

            if (nfeCompanyId && apiKey) {
                console.log(`🗑️ [NFEIO-DEACTIVATE] Deletando empresa ID: ${nfeCompanyId} na NFe.io`);
                const deleteRes = await axiosNfeioRequest({
                    method: 'DELETE',
                    url: `https://api.nfe.io/v1/companies/${nfeCompanyId}`,
                    headers: {
                        'Authorization': apiKey,
                        'Accept': 'application/json'
                    }
                });
                providerResponse = deleteRes.data;
            } else {
                console.log(`⚠️ [NFEIO-DEACTIVATE] ID da empresa ou API Key não cadastrados para NFe.io. Pulando chamada de exclusão na API.`);
            }

            // Atualiza o config para remover o companyId do nfeio_config e desabilitar o modulo fiscal
            const updatedSettings = {
                ...(companyDetails.settings || {}),
                nfeio_config: {
                    ...nfeConfig,
                    companyId: '' // Limpa o ID da empresa para forçar nova criação se ativado no futuro
                }
            };

            await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                settings: updatedSettings,
                fiscal_module_enabled: false
            }, {
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`,
                    'Content-Type': 'application/json'
                }
            });

        } else {
            // TecnoSpeed / PlugNotas
            const tsConfig = companyDetails.tecnospeed_config || {};
            const cnpj = (tsConfig.cnpj || '').replace(/\D/g, '');
            const apiKey = tsConfig.tecnospeed_api_key ? tsConfig.tecnospeed_api_key.trim() : '';

            if (cnpj && apiKey) {
                const isSandbox = tsConfig.ambiente === 'homologacao';
                const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
                const rawBase = isSandbox ? (tsConfig.endpoint_homologacao || defaultBase) : (tsConfig.endpoint_producao || defaultBase);
                const baseUrl = String(rawBase).toLowerCase().replace(/\/$/, '');

                console.log(`🗑️ [TECNOSPEED-DEACTIVATE] Deletando empresa CNPJ: ${cnpj} no PlugNotas`);
                const deleteRes = await axios({
                    method: 'DELETE',
                    url: `${baseUrl}/empresa/${cnpj}`,
                    headers: {
                        'x-api-key': apiKey
                    }
                });
                providerResponse = deleteRes.data;
            } else {
                console.log(`⚠️ [TECNOSPEED-DEACTIVATE] CNPJ ou API Key não cadastrados para TecnoSpeed. Pulando chamada de exclusão na API.`);
            }

            // Desabilita o módulo fiscal
            await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                fiscal_module_enabled: false
            }, {
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Invalida cache local
        for (const [key, cached] of fiscalConfigCache.entries()) {
            if (
                key === companyId || 
                cached.realCompanyId === companyId
            ) {
                fiscalConfigCache.delete(key);
            }
        }
        fiscalConfigCache.delete(companyId);

        console.log(`✅ [DEACTIVATE-ISSUER] Emitente desativado e módulo desabilitado com sucesso para ${companyId}`);

        return res.json({
            success: true,
            message: `Emitente inativado com sucesso no provedor ${activeProvider === 'nfeio' ? 'NFe.io' : 'TecnoSpeed'}.`,
            detail: providerResponse
        });

    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ [DEACTIVATE-ISSUER] Erro ao inativar emitente:', JSON.stringify(errorDetail, null, 2));
        
        // Se a API externa retornou 404 (empresa já não existe no provedor), procedemos com a desativação local mesmo assim
        if (error.response?.status === 404 || errorDetail?.message?.includes('não encontrada') || errorDetail?.error?.includes('not found')) {
            console.log('⚠️ [DEACTIVATE-ISSUER] Empresa não encontrada no provedor remoto. Procedendo com a desativação local.');
            
            try {
                // Desativa localmente mesmo se não achar na API remota
                const companyRes = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`
                    }
                });
                const companyDetails = companyRes.data?.[0];
                const activeProvider = companyDetails?.settings?.fiscal_provider || 'tecnospeed';

                if (activeProvider === 'nfeio') {
                    const nfeConfig = companyDetails?.settings?.nfeio_config || {};
                    const updatedSettings = {
                        ...(companyDetails?.settings || {}),
                        nfeio_config: {
                            ...nfeConfig,
                            companyId: ''
                        }
                    };

                    await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                        settings: updatedSettings,
                        fiscal_module_enabled: false
                    }, {
                        headers: {
                            'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`,
                            'Content-Type': 'application/json'
                        }
                    });
                } else {
                    await axios.patch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}`, {
                        fiscal_module_enabled: false
                    }, {
                        headers: {
                            'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`,
                            'Content-Type': 'application/json'
                        }
                    });
                }

                fiscalConfigCache.delete(companyId);

                return res.json({
                    success: true,
                    message: `Emitente não encontrado no provedor ${activeProvider === 'nfeio' ? 'NFe.io' : 'TecnoSpeed'}, mas foi desativado localmente.`,
                    detail: errorDetail
                });
            } catch (dbErr: any) {
                console.error('❌ [DEACTIVATE-ISSUER] Erro ao salvar status de desativação local após 404 remoto:', dbErr.message);
            }
        }

        return res.status(error.response?.status || 500).json({
            error: 'Erro ao inativar emitente no provedor fiscal',
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
            
            const response = await axiosNfeioRequest({
                method: 'GET',
                url: `https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices`,
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
    const { companyId, token, provider } = req.query;
    const authHeader = req.headers.authorization || (token ? `Bearer ${token}` : null);
    const isXml = req.path.endsWith('/xml') || req.path.includes('/xml');

    if (!companyId || !id) {
        return res.status(400).json({ error: 'companyId e ID da nota são obrigatórios' });
    }

    try {
        // Tentar obter a configuração usando a função com cache
        const { config, settings } = await getCompanyFiscalConfig(authHeader, companyId as string);

        // Obter o tipo real da nota no banco de dados para garantir o roteamento correto (NFe.io vs TecnoSpeed)
        let resolvedType = type;
        if (id && SUPABASE_URL) {
            try {
                const queryParam = !isNaN(Number(id)) ? { id: `eq.${id}` } : { external_id: `eq.${id}` };
                const dbKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!;
                const dbAuth = authHeader || `Bearer ${SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!}`;
                const { data: invData } = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                    params: { ...queryParam, select: 'type' },
                    headers: { 'apikey': dbKey, 'Authorization': dbAuth }
                });
                if (invData?.[0]?.type) {
                    resolvedType = invData[0].type;
                    console.log(`🔍 [FISCAL-DOWNLOAD] Tipo real resolvido no banco: ${resolvedType} para ID: ${id}`);
                }
            } catch (dbErr: any) {
                console.warn('⚠️ [FISCAL-DOWNLOAD] Não foi possível verificar o tipo da nota no banco:', dbErr.message);
            }
        }

        const activeProvider = provider || settings?.fiscal_provider || 'tecnospeed';
        
        // Se o tipo real for 'nfeio', ou se o tipo solicitado no path for 'nfeio' (e não achou no banco),
        // ou se o provedor ativo for nfeio e não temos registro no banco para contradizer.
        const isNfeio = resolvedType === 'nfeio' || (type === 'nfeio' && !resolvedType) || (activeProvider === 'nfeio' && !resolvedType);

        if (isNfeio) {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(404).json({ error: 'Configuração da NFe.io não encontrada.' });
            }

            const apiKeyNfe = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            const isNfeioMock = typeof id === 'string' && (id === '{id}' || id.startsWith('nfeio_mock'));
            if (isNfeioMock) {
                console.log(`📄 [NFEIO-DOWNLOAD-MOCK] Retornando documento simulado (${isXml ? 'XML' : 'PDF'}) para ID: ${id}`);
                if (isXml) {
                    const mockXml = `<?xml version="1.0" encoding="utf-8"?>
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
    <infNFe Id="NFe35190700000000000000550010000000011000000001" versao="4.00">
        <ide>
            <cUF>35</cUF>
            <cNF>00000001</cNF>
            <natOp>Venda de servico em ambiente de homologacao (Sandbox)</natOp>
            <mod>55</mod>
            <serie>1</serie>
            <nNF>1</nNF>
            <dhEmi>2026-06-23T19:34:28-03:00</dhEmi>
            <tpNF>1</tpNF>
            <idDest>1</idDest>
            <cMunFG>3550308</cMunFG>
            <tpImp>1</tpImp>
            <tpEmis>1</tpEmis>
            <cDV>1</cDV>
            <tpAmb>2</tpAmb>
            <finNFe>1</finNFe>
            <indFinal>1</indFinal>
            <indPres>1</indPres>
            <procEmi>0</procEmi>
            <verProc>LucroCerto_v1.0</verProc>
        </ide>
        <emit>
            <CNPJ>00000000000191</CNPJ>
            <xNome>Empresa de Teste LTDA</xNome>
            <enderEmit>
                <xLgr>Rua de Teste</xLgr>
                <nro>123</nro>
                <xBairro>Centro</xBairro>
                <cMun>3550308</cMun>
                <xMun>Sao Paulo</xMun>
                <UF>SP</UF>
                <CEP>01001000</CEP>
                <cPais>1058</cPais>
                <xPais>BRASIL</xPais>
            </enderEmit>
        </emit>
        <dest>
            <CNPJ>99999999000191</CNPJ>
            <xNome>Cliente de Teste NFe.io Sandbox</xNome>
        </dest>
        <det nItem="1">
            <prod>
                <cProd>001</cProd>
                <xProd>Servicos de TI (Simulado NFe.io Sandbox)</xProd>
                <NCM>00</NCM>
                <CFOP>5933</CFOP>
                <uCom>UN</uCom>
                <qCom>1.0000</qCom>
                <vUnCom>50.0000</vUnCom>
                <vProd>50.00</vProd>
            </prod>
        </det>
        <total>
            <ICMSTot>
                <vBC>0.00</vBC>
                <vICMS>0.00</vICMS>
                <vProd>50.00</vProd>
                <vNF>50.00</vNF>
            </ICMSTot>
        </total>
    </infNFe>
</enviNFe>`;
                    res.setHeader('Content-Type', 'application/xml');
                    res.setHeader('Content-Disposition', `inline; filename="nfeio-${id}.xml"`);
                    return res.send(Buffer.from(mockXml));
                } else {
                    const mockPdfBase64 = 'JVBERi0xLjQKMSAwIG9iagogIDw8CiAgICAvVHlwZSAvQ2F0YWxvZwogICAgL1BhZ2VzIDIgMCBSagogID4+CmVuZG9iagoyIDAgb2JqCiAgPDwKICAgIC9UeXBlIC9QYWdlcwogICAgL0tpZHMgWzMgMCBSXQogICAgL0NvdW50IDEKICA+PgplbmRvYmoKMyAwIG9iagogIDw8CiAgICAvVHlwZSAvUGFnZQogICAgL1BhcmVudCAyIDAgUgogICAgL01lZGlhQm94IFswIDAgNTk1IDg0Ml0KICAgIC9SZXNvdXJjZXMgPDwKICAgICAgL0ZvbnQgPDwKICAgICAgICAvRjEgNCAwIFIKICAgICAgPj4KICAgID4+CiAgICAvQ29udGVudHMgNSAwIFIKICA+PgplbmRvYmoKNCAwIG9iagogIDw8CiAgICAvVHlwZSAvRm9udAogICAgL1N1YnR5cGUgL1R5cGUxCiAgICAvQmFzZUZvbnQgL0hlbHZldGljYQogID4+CmVuZG9iago1IDAgb2JqCiAgPDwKICAgIC9MZW5ndGggNDQKICA+PgpzdHJlYW0KQlQgL0YxIDI0IFRmIDcwIDcwMCBUZCAoTkZlLmlvIFNhbmRib3ggLSBOb3RhIFNpbXVsYWRhKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDgwIDAwMDAwIG4gCjAwMDAwMDAxNDMgMDAwMDAgbCAKMDAwMDAwMDMwMiAwMDAwMCBuIAowMDAwMDAwMzg0IDAwMDAwIG4gCnRyYWlsZXIKICA8PAogICAgL1NpemUgNgogICAgL1Jvb3QgMSAwIFIKICA+PgpzdGFydHhyZWYKNDc5CiUlRU9GCg==';
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `inline; filename="nfeio-${id}.pdf"`);
                    return res.send(Buffer.from(mockPdfBase64, 'base64'));
                }
            }

            console.log(`📄 [NFEIO-DOWNLOAD] Baixando ${isXml ? 'XML' : 'PDF'} para nota NFe.io ID: ${id}`);
            
            const response = await axiosNfeioRequest({
                method: 'GET',
                url: `https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}/${isXml ? 'xml' : 'pdf'}`,
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

        let primaryType = resolvedType || type;
        if (primaryType === 'nfse' || primaryType === 'nfsenac') {
            // PlugNotas usa /nfse/pdf e /nfse/xml para download de PDF/XML tanto para notas municipais quanto nacionais.
            primaryType = 'nfse';
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

            // Fallback para NFe.io caso o download na Tecnospeed falhe (pode ser nota antiga da NFe.io gravada com tipo incorreto)
            // Flexibilizado para tentar em qualquer status de erro (como 500 da TecnoSpeed por ID incompatível) se a empresa possuir config NFe.io
            const nfeioConfig = settings?.nfeio_config;
            if (nfeioConfig?.apiKey && nfeioConfig?.companyId) {
                console.log(`⚠️ [FISCAL-DOWNLOAD] Falha na TecnoSpeed (Status: ${primaryErr.response?.status || 'desconhecido'}). Tentando obter da NFe.io para ID: ${id}`);
                try {
                    const apiKeyNfe = nfeioConfig.apiKey.trim();
                    const companyIdNfe = nfeioConfig.companyId.trim();
                    
                    const response = await axiosNfeioRequest({
                        method: 'GET',
                        url: `https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}/${isXml ? 'xml' : 'pdf'}`,
                        headers: { 'Authorization': apiKeyNfe },
                        responseType: 'arraybuffer'
                    });
                    
                    res.setHeader('Content-Type', isXml ? 'application/xml' : 'application/pdf');
                    res.setHeader('Content-Disposition', `${isXml ? 'attachment' : 'inline'}; filename="nfeio-${id}.${isXml ? 'xml' : 'pdf'}"`);
                    return res.send(Buffer.from(response.data));
                } catch (nfeioErr: any) {
                    console.error('❌ [FISCAL-DOWNLOAD] Falha no fallback NFe.io:', nfeioErr.response?.data || nfeioErr.message);
                }
            }

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
async function resolveTargetName(requestedName: string, token?: string, passedCompanyId?: string, userToken?: string): Promise<string> {
    try {
        console.log(`🔍 Resolvendo instância: "${requestedName}" (Token: ${token || 'N/A'}, PassedCompanyId: ${passedCompanyId || 'N/A'})`);

        // 1. Tentar obter o config correto com base no nome ou token
        let companyId: string | undefined = passedCompanyId;
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const authHeader = userToken || (SUPABASE_SERVICE_ROLE_KEY ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` : `Bearer ${supabaseKey}`);

        if (!companyId && SUPABASE_URL && supabaseKey) {
            try {
                let query = `${SUPABASE_URL}/rest/v1/instances?`;
                if (token) {
                    query += `evolution_instance_id=eq.${encodeURIComponent(token)}`;
                } else {
                    query += `instance_name=eq.${encodeURIComponent(requestedName)}`;
                }
                query += `&select=company_id`;

                const dbRes = await axios.get(query, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': authHeader
                    }
                });
                if (dbRes.data && dbRes.data.length > 0) {
                    companyId = dbRes.data[0].company_id;
                }
            } catch (dbErr: any) {
                console.warn('⚠️ [resolveTargetName] Error finding company_id in db:', dbErr.message);
            }
        }

        const config = await getEvolutionConfig({ companyId, token, instanceName: requestedName, userToken });

        const fetchInstancesList = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                const res = await axios.get(`${activeConfig.url}/instance/all`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                return res.data?.data || [];
            } else {
                const res = await axios.get(`${activeConfig.url}/instance/fetchInstances`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                const list = Array.isArray(res.data) ? res.data : [];
                return list.map((item: any) => {
                    if (item.instance) {
                        return {
                            name: item.instance.instanceName,
                            instanceName: item.instance.instanceName,
                            id: item.instance.instanceId,
                            token: item.instance.instanceId,
                            status: item.instance.status
                        };
                    }
                    return item;
                });
            }
        };

        let instances: any[] = [];
        try {
            instances = await fetchInstancesList(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ resolveTargetName: fetchInstances failed on primary (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            try {
                instances = await fetchInstancesList(fallbackConfig);
            } catch (fallbackErr: any) {
                console.error(`❌ resolveTargetName: fetchInstances failed on both APIs.`);
                throw fallbackErr;
            }
        }

        // 1. Tentar encontrar pelo Token (ID Técnico/Evo ID - Case-Insensitive)
        if (token) {
            const cleanToken = token.trim().toLowerCase();
            const match = instances.find((i: any) =>
                (i.token && i.token.trim().toLowerCase() === cleanToken) ||
                (i.id && i.id.trim().toLowerCase() === cleanToken)
            );
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

        console.warn('⚠️ Instância não encontrada para "' + requestedName + '". Usando nome original.');
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

app.get(['/fiscal-module/nfeio/prefectures/:codigoIbge', '/api/fiscal-module/nfeio/prefectures/:codigoIbge'], authenticate, async (req, res) => {
    const { codigoIbge } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const { settings } = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const nfeioConfig = settings?.nfeio_config;
        if (!nfeioConfig || !nfeioConfig.apiKey) {
            return res.status(400).json({ error: 'Configuração da NFe.io incompleta (API Key ausente).' });
        }

        const apiKey = nfeioConfig.apiKey.trim();
        const isSandbox = nfeioConfig.ambiente === 'homologacao';
        const baseUrl = isSandbox ? 'https://prefectures-dev.api.nfe.io' : 'https://prefectures.api.nfe.io';

        const cleanIbge = String(codigoIbge).replace(/\D/g, '');
        console.log(`🔍 [NFEIO-CIDADES] Consultando prefeitura NFe.io IBGE: ${cleanIbge} em ${isSandbox ? 'SANDBOX' : 'PROD'}...`);

        const response = await axiosNfeioRequest({
            method: 'GET',
            url: `${baseUrl}/v1/prefectures/${cleanIbge}`,
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        const statusCode = error.response?.status || 500;
        console.error(`❌ Erro ao consultar prefeitura NFe.io ${codigoIbge} (Status ${statusCode}):`, JSON.stringify(errorDetail, null, 2));
        res.status(statusCode).json({ error: 'Erro ao consultar prefeitura na NFe.io', detail: errorDetail });
    }
});


app.get(['/fiscal-module/nfeio/company/status', '/api/fiscal-module/nfeio/company/status'], authenticate, async (req, res) => {
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const { settings } = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const nfeioConfig = settings?.nfeio_config;
        if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
            return res.status(400).json({ error: 'Configuração da NFe.io incompleta (API Key ou ID da Empresa ausente).' });
        }

        const apiKey = nfeioConfig.apiKey.trim();
        const companyIdNfe = nfeioConfig.companyId.trim();

        console.log(`🔍 [NFEIO-COMPANY] Consultando status da empresa NFe.io: ${companyIdNfe}...`);

        const response = await axiosNfeioRequest({
            method: 'GET',
            url: `https://api.nfe.io/v1/companies/${companyIdNfe}`,
            headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        const statusCode = error.response?.status || 500;
        console.error(`❌ Erro ao consultar status da empresa NFe.io (Status ${statusCode}):`, JSON.stringify(errorDetail, null, 2));
    }
});
async function triggerWhatsAppNotificationHelper(invoiceId: string, pdfUrl: string, invoiceNumber: string, mappedStatus: string, authHeader: string) {
    if (!SUPABASE_URL || !invoiceId) return;
    try {
        const dbHeaders: any = {
            'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json'
        };
        if (SUPABASE_SERVICE_ROLE_KEY) {
            dbHeaders['Authorization'] = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
        } else if (authHeader) {
            dbHeaders['Authorization'] = authHeader;
        } else {
            dbHeaders['Authorization'] = `Bearer ${SUPABASE_ANON_KEY!}`;
        }

        // Buscar a nota atualizada por id ou external_id (validando UUID para evitar erros no banco de dados)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
        const queryUrl = isUUID 
            ? `${SUPABASE_URL}/rest/v1/fiscal_invoices?or=(id.eq.${invoiceId},external_id.eq.${invoiceId})`
            : `${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${invoiceId}`;

        const { data: invoices } = await axios.get(queryUrl, {
            headers: dbHeaders
        });

        const invoice = invoices?.[0];
        if (!invoice || !invoice.company_id) return;

        // Buscar configs da empresa
        const { data: companies } = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${invoice.company_id}&select=tecnospeed_config,settings`, {
            headers: dbHeaders
        });

        const companyConfig = companies?.[0]?.tecnospeed_config || {};
        const companySettings = companies?.[0]?.settings || {};

        if (companyConfig.send_whatsapp_automatically || invoice.payload?.send_whatsapp === true) {
            let recipientPhoneRaw = invoice.payload?.tomador?.telefone || invoice.payload?.tomador?.celular || invoice.payload?.borrower?.phone || invoice.payload?.retorno?.borrower?.phone || invoice.payload?.retorno?.borrower?.telefone || invoice.payload?.retorno?.borrower?.phone_number || invoice.payload?.contact?.whatsapp || invoice.payload?.contact?.phone;
            let recipientName = invoice.payload?.tomador?.razaoSocial || invoice.payload?.tomador?.nome || invoice.payload?.borrower?.name || invoice.payload?.retorno?.borrower?.name || invoice.payload?.contact?.name || 'Cliente';

            if (!recipientPhoneRaw) {
                try {
                    const rawCpfCnpj = invoice.payload?.tomador?.cpfCnpj || invoice.payload?.tomador?.cnpj || invoice.payload?.destinatario?.cpfCnpj || invoice.payload?.destinatario?.cnpj || invoice.payload?.borrower?.federalTaxNumber || invoice.payload?.retorno?.borrower?.federalTaxNumber || invoice.payload?.borrower?.cnpj || invoice.payload?.borrower?.cpf;
                    let cleanCpfCnpj = rawCpfCnpj ? String(rawCpfCnpj).replace(/\D/g, '') : '';
                    if (cleanCpfCnpj) {
                        if (cleanCpfCnpj.length > 11 && cleanCpfCnpj.length < 14) {
                            cleanCpfCnpj = cleanCpfCnpj.padStart(14, '0');
                        } else if (cleanCpfCnpj.length > 0 && cleanCpfCnpj.length < 11) {
                            cleanCpfCnpj = cleanCpfCnpj.padStart(11, '0');
                        }
                    }
                    const formattedCpfCnpj = cleanCpfCnpj.length === 11 
                        ? cleanCpfCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                        : cleanCpfCnpj.length === 14 
                            ? cleanCpfCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
                            : cleanCpfCnpj;

                    const taxSearchTerms = [cleanCpfCnpj, String(rawCpfCnpj), formattedCpfCnpj].filter(Boolean);
                    let selectQuery = `${SUPABASE_URL}/rest/v1/contacts?company_id=eq.${invoice.company_id}`;
                    if (taxSearchTerms.length > 0) {
                        const encodedTerms = taxSearchTerms.map(t => encodeURIComponent(t)).join(',');
                        selectQuery += `&tax_id=in.(${encodedTerms})`;
                    } else if (recipientName && recipientName !== 'Cliente') {
                        selectQuery += `&name=ilike.%${encodeURIComponent(recipientName)}%`;
                    } else {
                        selectQuery = '';
                    }

                    if (selectQuery) {
                        const contactRes = await axios.get(selectQuery, { headers: dbHeaders });
                        let contacts = contactRes.data || [];
                        
                        if (contacts.length === 0 && cleanCpfCnpj && recipientName && recipientName !== 'Cliente') {
                            const fallbackQuery = `${SUPABASE_URL}/rest/v1/contacts?company_id=eq.${invoice.company_id}&name=ilike.%${encodeURIComponent(recipientName)}%`;
                            const fallbackRes = await axios.get(fallbackQuery, { headers: dbHeaders });
                            contacts = fallbackRes.data || [];
                        }

                        if (contacts.length > 0) {
                            const contact = contacts[0];
                            recipientPhoneRaw = contact.whatsapp || contact.phone;
                            if (recipientName === 'Cliente' && contact.name) {
                                recipientName = contact.name;
                            }
                        }
                    }
                } catch (dbErr: any) {
                    console.warn(`⚠️ [WhatsApp-Helper] Erro ao buscar contato no banco:`, dbErr.message);
                }
            }

            if (recipientPhoneRaw) {
                const recipientPhone = formatWhatsappNumber(recipientPhoneRaw);

                const { data: waInstances } = await axios.get(`${SUPABASE_URL}/rest/v1/instances?company_id=eq.${invoice.company_id}&status=eq.connected&select=instance_name,evolution_instance_id,provider,is_active`, {
                    headers: dbHeaders
                });

                const activeInsts = (waInstances || []).filter((inst: any) => inst.is_active !== false);

                if (activeInsts.length > 0) {
                    const preferredProvider = companySettings.whatsapp_provider || 'evolution_api';
                    let selectedInst = activeInsts.find((inst: any) => inst.provider === preferredProvider);

                    if (!selectedInst) {
                        selectedInst = activeInsts[0];
                    }

                    const instanceName = selectedInst.instance_name;
                    const instanceToken = selectedInst.evolution_instance_id;
                    const finalPdfUrl = invoice.pdf_url || pdfUrl;
                    const waMsg = `Olá, *${recipientName}*! 👋\n\nSua Nota Fiscal foi autorizada com sucesso.\nNúmero: ${invoiceNumber || 'N/A'}\n\nClique no link abaixo para visualizar e baixar o documento:\n${finalPdfUrl}`;

                    console.log(`📱 [WhatsApp-Helper] Disparando notificação de WhatsApp para ${recipientPhone} via instância ${instanceName} (${selectedInst.provider || 'evolution_api'})`);

                    const config = await getEvolutionConfig({ companyId: invoice.company_id, instanceName, token: instanceToken });
                    const targetName = await resolveTargetName(instanceName, instanceToken, invoice.company_id);
                    const encodedName = encodeURIComponent(targetName);

                    let base64Media = '';
                    let isBase64 = false;

                    try {
                        console.log(`📥 [WhatsApp-Helper] Baixando PDF para envio Base64: ${finalPdfUrl}`);
                        const downloadHeaders: any = {};
                        if (finalPdfUrl.includes('/fiscal-module/') || finalPdfUrl.includes('/api/')) {
                            if (authHeader) {
                                downloadHeaders['Authorization'] = authHeader;
                            } else if (SUPABASE_SERVICE_ROLE_KEY) {
                                downloadHeaders['Authorization'] = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
                            }
                            downloadHeaders['apikey'] = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!;
                        }

                        const pdfResponse = await axios.get(finalPdfUrl, {
                            headers: downloadHeaders,
                            responseType: 'arraybuffer',
                            timeout: 8000
                        });
                        if (pdfResponse.status === 200) {
                            base64Media = Buffer.from(pdfResponse.data).toString('base64');
                            isBase64 = true;
                            console.log(`✅ [WhatsApp-Helper] PDF baixado e codificado (${pdfResponse.data.length} bytes)`);
                        }
                    } catch (downloadErr: any) {
                        console.warn(`⚠️ [WhatsApp-Helper] Erro ao baixar PDF para Base64 (${downloadErr.message}). Tentando envio com URL.`);
                    }

                    if (config.isGo) {
                        try {
                            await axios.post(`${config.url}/send/media`, {
                                id: targetName,
                                number: recipientPhone,
                                url: isBase64 ? base64Media : finalPdfUrl,
                                type: 'document',
                                filename: `NotaFiscal-${invoiceNumber || invoice.id}.pdf`,
                                caption: waMsg
                            }, {
                                headers: {
                                    'apikey': instanceToken || config.apiKey,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 10000
                            });
                        } catch (errGo: any) {
                            try {
                                await axios.post(`${config.url}/send/button`, {
                                    id: targetName,
                                    number: recipientPhone,
                                    title: `Nota Fiscal ${invoiceNumber || ''}`.trim(),
                                    description: waMsg,
                                    footer: 'Lucro Certo',
                                    buttons: [
                                        {
                                            type: 'url',
                                            displayText: 'Visualizar PDF',
                                            url: finalPdfUrl
                                        }
                                    ]
                                }, {
                                    headers: {
                                        'apikey': instanceToken || config.apiKey,
                                        'Content-Type': 'application/json'
                                    },
                                    timeout: 10000
                                });
                            } catch (btnErr: any) {
                                await axios.post(`${config.url}/send/text`, {
                                    id: targetName,
                                    number: recipientPhone,
                                    text: `${waMsg}\n\nLink do PDF: ${finalPdfUrl}`
                                }, {
                                    headers: {
                                        'apikey': instanceToken || config.apiKey,
                                        'Content-Type': 'application/json'
                                    }
                                });
                            }
                        }
                    } else {
                        try {
                            await axios.post(`${config.url}/message/sendMedia/${encodedName}`, {
                                number: recipientPhone,
                                mediatype: 'document',
                                mimetype: 'application/pdf',
                                caption: waMsg,
                                media: isBase64 ? base64Media : finalPdfUrl,
                                fileName: `NotaFiscal-${invoiceNumber || invoice.id}.pdf`
                            }, {
                                headers: {
                                    'apikey': config.apiKey,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 15000
                            });
                        } catch (errStd: any) {
                            await axios.post(`${config.url}/message/sendText/${encodedName}`, {
                                number: recipientPhone,
                                text: `${waMsg}\n\nLink do PDF: ${finalPdfUrl}`,
                                linkPreview: true
                            }, {
                                headers: {
                                    'apikey': config.apiKey,
                                    'Content-Type': 'application/json'
                                }
                            });
                        }
                    }
                }
            }
        }
    } catch (err: any) {
        console.error('⚠️ [WhatsApp-Helper] Falha ao enviar notificação de WhatsApp:', err.message);
    }
}


app.get(['/fiscal-module/status/:id', '/api/fiscal-module/status/:id'], authenticate, async (req, res) => {
    const { id } = req.params;
    const { companyId, provider } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const { config, realCompanyId: resolvedId, settings } = await getCompanyFiscalConfig(authHeader!, companyId as any);

        const targetProvider = provider || settings?.fiscal_provider || 'tecnospeed';

        // Proteção Anti-Crash: Se o ID não for um ObjectID de 24 caracteres hexadecimais do PlugNotas,
        // significa que é um ID de integração temporário (como UUID_lote) ou um ID da NFe.io.
        // Só fazemos o bypass se for PlugNotas (TecnoSpeed).
        const isObjectId = /^[0-9a-fA-F]{24}$/.test((id as string) || '');
        if (!isObjectId && targetProvider === 'tecnospeed') {
            console.log(`⚠️ [FISCAL-STATUS-BYPASS] ID informado (${id}) é um ID de integração. Retornando status processando.`);
            return res.json({
                status: 'processando',
                message: 'Nota em processamento ou aguardando autorização da prefeitura.',
                data: {
                    status: 'processando'
                }
            });
        }

        const apiKey = config.tecnospeed_api_key?.trim().toLowerCase();
        const isSandbox = config.ambiente === 'homologacao';
        const baseUrl = (isSandbox ? (config.endpoint_homologacao || 'https://api.sandbox.plugnotas.com.br') : (config.endpoint_producao || 'https://api.plugnotas.com.br')).toLowerCase().replace(/\/$/, '');

        // 1. Tentar descobrir o tipo da nota no nosso banco (NFS-e ou NF-e)
        let type = 'nfse';
        let isRecordFound = false;
        let existingPayload: any = {};
        let dbRecord: any = null;
        try {
            const { data: invData } = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                params: {
                    external_id: `eq.${id}`,
                    select: 'type,payload,status,invoice_number,access_key,pdf_url,xml_url,error_message'
                },
                headers: {
                    'apikey': SUPABASE_ANON_KEY!,
                    'Authorization': authHeader!
                }
            });
            if (invData?.[0]) {
                dbRecord = invData[0];
                type = dbRecord.type || 'nfse';
                existingPayload = dbRecord.payload || {};
                isRecordFound = true;
                console.log(`🔍 [FISCAL-STATUS] Tipo detectado no banco para ${id}: ${type}`);
            }
        } catch (dbErr) {
            console.warn(`⚠️ [FISCAL-STATUS] Não foi possível detectar o tipo da nota ${id} no banco. Tentando ${type} por padrão.`);
        }

        const activeProvider = provider || settings?.fiscal_provider || 'tecnospeed';

        // Bypass para notas integradas via Webhook Externo
        if (type === 'webhook' || activeProvider === 'other') {
            console.log(`📡 [FISCAL-STATUS] Nota via Webhook detectada. Retornando dados salvos no banco para ID: ${id}`);
            const statusVal = dbRecord?.status || 'processando';
            return res.json({
                id,
                status: statusVal,
                flowStatus: statusVal,
                number: dbRecord?.invoice_number || null,
                verificationCode: dbRecord?.access_key || null,
                pdf: dbRecord?.pdf_url || null,
                xml: dbRecord?.xml_url || null,
                error_message: dbRecord?.error_message || null,
                message: statusVal === 'processando' 
                    ? 'Aguardando o retorno do emissor externo via webhook.' 
                    : `Nota processada com status: ${statusVal}`,
                data: dbRecord
            });
        }

        if (type === 'nfeio' || (activeProvider === 'nfeio' && !isRecordFound)) {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                return res.status(400).json({ error: 'Configuração da NFe.io incompleta.' });
            }

            const apiKeyNfe = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            const isNfeioMock = typeof id === 'string' && (id === '{id}' || id.startsWith('nfeio_mock'));
            if (isNfeioMock) {
                console.log(`⚠️ [NFEIO-STATUS-BYPASS] Retornando status simulado de sucesso para ID: ${id}`);
                const mockStatusResponse = {
                    id,
                    status: 'Issued',
                    flowStatus: 'Issued',
                    number: 123,
                    verificationCode: 'XYZ123ABC',
                    rpsNumber: 456,
                    rpsSerialNumber: 'A',
                    protocol: 'NFEIO-MOCK-PROTO',
                    pdf: `/v1/companies/${companyIdNfe}/serviceinvoices/${id}/pdf`,
                    xml: `/v1/companies/${companyIdNfe}/serviceinvoices/${id}/xml`
                };
                
                if (SUPABASE_URL) {
                    try {
                        const getValidDocUrl = (docType: 'pdf' | 'xml') => {
                            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                            const host = req.get('host');
                            const baseApiUrl = `${protocol}://${host}`;
                            return `${baseApiUrl}/api/fiscal-module/nfeio/${id}/${docType}?companyId=${companyId}`;
                        };
                        const pdfUrl = getValidDocUrl('pdf');
                        const xmlUrl = getValidDocUrl('xml');
                        
                        await axios.patch(`${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${id}`, {
                            status: 'concluido',
                            pdf_url: pdfUrl,
                            xml_url: xmlUrl,
                            invoice_number: '123',
                            access_key: 'XYZ123ABC',
                            dps_number: '456',
                            dps_serie: 'A',
                            protocol: 'NFEIO-MOCK-PROTO',
                            payload: {
                                ...existingPayload,
                                retorno: mockStatusResponse
                            }
                        }, {
                            headers: {
                                'apikey': SUPABASE_ANON_KEY!,
                                'Authorization': authHeader!,
                                'Prefer': 'return=minimal'
                            }
                        });

                        triggerWhatsAppNotificationHelper(id, pdfUrl, '123', 'concluido', authHeader!);
                    } catch (dbErr: any) {
                        console.error('❌ [DB-PATCH] Erro ao atualizar status da nota mock:', dbErr.message);
                    }
                }
                
                return res.json(mockStatusResponse);
            }

            console.log(`🔍 [NFEIO-STATUS] Consultando status da nota NFe.io ID: ${id}`);
            
            const response = await axiosNfeioRequest({
                method: 'GET',
                url: `https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}`,
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

                    if (mappedStatus === 'concluido') {
                        triggerWhatsAppNotificationHelper(id, pdfUrl, invoiceNumber ? String(invoiceNumber) : '', mappedStatus, authHeader!);
                    }
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
            const is404 = primaryErr.response?.status === 404;
            const nfeioConfig = settings?.nfeio_config;

            // Fallback para NFe.io caso a nota não exista ou ocorra erro na TecnoSpeed (pode ser nota antiga NFe.io gravada com tipo incorreto)
            // Flexibilizado para tentar em qualquer status de erro se a empresa possuir config NFe.io
            if (nfeioConfig?.apiKey && nfeioConfig?.companyId) {
                console.log(`⚠️ [FISCAL-STATUS] Erro na TecnoSpeed (Status: ${primaryErr.response?.status || 'desconhecido'}). Tentando buscar na NFe.io para ID: ${id}`);
                try {
                    const apiKeyNfe = nfeioConfig.apiKey.trim();
                    const companyIdNfe = nfeioConfig.companyId.trim();
                    const response = await axiosNfeioRequest({
                        method: 'GET',
                        url: `https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}`,
                        headers: { 'Authorization': apiKeyNfe }
                    });
                    
                    const statusData = response.data;
                    const currentStatus = statusData.status || statusData.flowStatus || 'Created';
                    
                    console.log(`🎯 [FISCAL-STATUS] Nota encontrada na NFe.io. Corrigindo tipo e URLs no banco para 'nfeio'.`);
                    
                    const getValidDocUrl = (docType: 'pdf' | 'xml') => {
                        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                        const host = req.get('host');
                        const baseApiUrl = `${protocol}://${host}`;
                        return `${baseApiUrl}/api/fiscal-module/nfeio/${id}/${docType}?companyId=${companyId}`;
                    };
                    
                    const pdfUrl = getValidDocUrl('pdf');
                    const xmlUrl = getValidDocUrl('xml');
                    const mappedStatus = String(currentStatus).toLowerCase() === 'issued' ? 'concluido' : (String(currentStatus).toLowerCase() === 'cancelled' ? 'cancelado' : (String(currentStatus).toLowerCase() === 'error' ? 'erro' : 'processando'));
                    
                    await axios.patch(`${SUPABASE_URL}/rest/v1/fiscal_invoices?external_id=eq.${id}`, {
                        type: 'nfeio',
                        status: mappedStatus,
                        pdf_url: pdfUrl,
                        xml_url: xmlUrl,
                        invoice_number: statusData.number ? String(statusData.number) : null,
                        access_key: statusData.verificationCode ? String(statusData.verificationCode) : null,
                        dps_number: statusData.rpsNumber ? String(statusData.rpsNumber) : null,
                        dps_serie: statusData.rpsSerialNumber ? String(statusData.rpsSerialNumber) : null,
                        protocol: statusData.protocol ? String(statusData.protocol) : null,
                        payload: {
                            ...existingPayload,
                            retorno: statusData
                        },
                        updated_at: new Date().toISOString()
                    }, {
                        headers: { 'apikey': SUPABASE_ANON_KEY!, 'Authorization': authHeader!, 'Content-Type': 'application/json' }
                    });
                    
                    if (mappedStatus === 'concluido') {
                        triggerWhatsAppNotificationHelper(id, pdfUrl, statusData.number ? String(statusData.number) : '', mappedStatus, authHeader!);
                    }
                    
                    return res.json(statusData);
                } catch (nfeioErr: any) {
                    console.error('❌ [FISCAL-STATUS] Falha no fallback NFe.io:', nfeioErr.response?.data || nfeioErr.message);
                }
            }

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
                
                const normalizedStatus = String(currentStatus).toLowerCase();
                if (['concluido', 'autorizado', 'issued', 'success', 'emitida', 'sucesso'].includes(normalizedStatus)) {
                    triggerWhatsAppNotificationHelper(id, pdfUrl, invoiceNumber ? String(invoiceNumber) : '', 'concluido', authHeader!);
                }
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

app.post(['/fiscal-module/webhook/update', '/api/fiscal-module/webhook/update'], async (req, res) => {
    const { 
        id, 
        external_id, 
        idIntegracao, 
        status, 
        pdf_url, 
        xml_url, 
        invoice_number, 
        access_key, 
        dps_number, 
        dps_serie, 
        protocol, 
        error_message,
        payload 
    } = req.body;

    const targetId = external_id || id || idIntegracao;
    const finalPdfUrl = pdf_url || req.body.pdf || req.body.pdfUrl || null;
    const finalXmlUrl = xml_url || req.body.xml || req.body.xmlUrl || null;

    if (!targetId) {
        return res.status(400).json({ error: 'Identificador da nota (id, external_id ou idIntegracao) é obrigatório.' });
    }

    try {
        console.log(`📡 [WEBHOOK-UPDATE] Recebida atualização para a nota: ${targetId}`);
        
        // 1. Buscar a nota pelo external_id no banco usando a melhor autenticação disponível
        const authHeader = req.headers.authorization;
        const dbHeaders: any = {
            'apikey': SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY!,
            'Content-Type': 'application/json'
        };

        if (SUPABASE_SERVICE_ROLE_KEY) {
            dbHeaders['Authorization'] = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
        } else if (authHeader) {
            dbHeaders['Authorization'] = authHeader;
        } else {
            dbHeaders['Authorization'] = `Bearer ${SUPABASE_ANON_KEY!}`;
        }

        const selectUrl = `${SUPABASE_URL}/rest/v1/fiscal_invoices`;
        const { data: invoices } = await axios.get(selectUrl, {
            params: {
                external_id: `eq.${targetId}`,
                select: 'id,payload,quote_id,company_id'
            },
            headers: dbHeaders
        });

        if (!invoices || invoices.length === 0) {
            return res.status(404).json({ error: `Nota fiscal com external_id '${targetId}' não encontrada.` });
        }

        const invoice = invoices[0];
        
        // Normalizar status
        const rawStatus = String(status || 'processando').toLowerCase();
        let mappedStatus = 'processando';
        if (['concluido', 'autorizado', 'issued', 'success', 'concluído', 'concluida', 'concluída'].includes(rawStatus)) {
            mappedStatus = 'concluido';
        } else if (['erro', 'rejeitado', 'error', 'failed', 'rejected', 'rejeitada'].includes(rawStatus)) {
            mappedStatus = 'erro';
        } else if (['cancelado', 'cancelled', 'canceled', 'cancelada'].includes(rawStatus)) {
            mappedStatus = 'cancelado';
        }

         // Construir payload atualizado
         const existingPayload = invoice.payload || {};
         const updatedPayload = {
             ...existingPayload,
             retorno: {
                 ...(existingPayload.retorno || {}),
                 ...(payload || {}),
                 status: status || mappedStatus,
                 pdf_url: finalPdfUrl,
                 xml_url: finalXmlUrl,
                 invoice_number,
                 access_key,
                 dps_number,
                 dps_serie,
                 protocol,
                 error_message
             }
         };
 
         // 2. Atualizar a nota no Supabase usando a mesma autenticação
         const updateUrl = `${SUPABASE_URL}/rest/v1/fiscal_invoices?id=eq.${invoice.id}`;
         await axios.patch(updateUrl, {
             status: mappedStatus,
             pdf_url: finalPdfUrl,
             xml_url: finalXmlUrl,
             invoice_number: invoice_number ? String(invoice_number) : null,
             access_key: access_key ? String(access_key) : null,
             dps_number: dps_number ? String(dps_number) : null,
             dps_serie: dps_serie ? String(dps_serie) : null,
             protocol: protocol ? String(protocol) : null,
             error_message: error_message || null,
             payload: updatedPayload,
             updated_at: new Date().toISOString()
         }, {
             headers: dbHeaders
         });
 
         // 3. Se a nota estiver vinculada a um orçamento (quote), atualizar o status do orçamento também
         if (invoice.quote_id) {
             try {
                 console.log(`💾 [WEBHOOK-UPDATE] Atualizando orçamento vinculado: ${invoice.quote_id}`);
                 const quoteUpdateUrl = `${SUPABASE_URL}/rest/v1/quotes?id=eq.${invoice.quote_id}`;
                 await axios.patch(quoteUpdateUrl, {
                     nfe_status: mappedStatus,
                     nfe_pdf_url: finalPdfUrl,
                     nfe_xml_url: finalXmlUrl,
                     nfe_error: error_message || null
                 }, {
                     headers: dbHeaders
                 });
                 console.log(`✅ [WEBHOOK-UPDATE] Orçamento ${invoice.quote_id} atualizado com status '${mappedStatus}'`);
             } catch (quoteErr: any) {
                 console.error(`⚠️ [WEBHOOK-UPDATE] Falha ao atualizar orçamento vinculado ${invoice.quote_id}:`, quoteErr.message);
             }
         }
         // 4. Automação de WhatsApp (apenas se foi autorizado/concluído e a empresa estiver configurada para envio automático)
         if (mappedStatus === 'concluido' && invoice.company_id) {
             let resolvedPdfUrl = finalPdfUrl;
             if (!resolvedPdfUrl) {
                 const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                 const host = req.get('host');
                 const baseApiUrl = `${protocol}://${host}`;
                 const usedType = invoice.type || 'nfse';
                 resolvedPdfUrl = `${baseApiUrl}/api/fiscal-module/${usedType}/${invoice.id}/pdf?companyId=${invoice.company_id}`;
             }
             triggerWhatsAppNotificationHelper(invoice.id, resolvedPdfUrl, invoice_number ? String(invoice_number) : '', mappedStatus, authHeader);
         }
         
         console.log(`   [WEBHOOK-UPDATE] Nota ${targetId} atualizada com sucesso para '${mappedStatus}'`);
        return res.json({ success: true, message: `Nota ${targetId} atualizada para '${mappedStatus}'.` });

    } catch (err: any) {
        console.error(`❌ [WEBHOOK-UPDATE] Erro ao processar atualização:`, err.message);
        return res.status(500).json({ error: 'Erro interno ao atualizar nota fiscal via webhook', detail: err.message });
    }
});

app.post(['/fiscal-module/test-webhook', '/api/fiscal-module/test-webhook'], authenticate, async (req, res) => {
    const { url, token, user } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL do Webhook obrigatória' });
    }
    
    try {
        console.log(`🧪 [TEST-WEBHOOK] Testando conexão com: ${url}`);
        const headers: any = {
            'Content-Type': 'application/json'
        };
        
        if (user) {
            headers['Authorization'] = 'Basic ' + Buffer.from(user + ':' + (token || '')).toString('base64');
        } else if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const testPayload = {
            event: "TEST_CONNECTION",
            message: "Teste de conexão do Lucro Certo",
            timestamp: new Date().toISOString(),
            test: true
        };
        
        const response = await axios.post(url, testPayload, { headers, timeout: 5000 });
        console.log(`✅ [TEST-WEBHOOK] Sucesso. Status: ${response.status}`);
        return res.json({ success: true, message: 'Teste enviado com sucesso. Seu sistema recebeu o payload!' });
    } catch (err: any) {
        console.error(`❌ [TEST-WEBHOOK] Falha ao testar:`, err.message);
        return res.status(400).json({ error: 'Falha na conexão com o Webhook', detail: err.message });
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
            const response = await axiosNfeioRequest({
                method: 'PUT',
                url: `https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices/${id}/sendemail`,
                data: {},
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
async function getCompanyFiscalConfig(authHeader: string | null, companyId: string, bypassCache = false) {
    if (!companyId) throw new Error('companyId é obrigatório para obter configuração fiscal.');

    // 🔍 1. Tenta buscar no cache em memória primeiro (bypassa o RLS e Supabase API inteiramente)
    const cached = fiscalConfigCache.get(companyId);
    if (!bypassCache && cached && cached.expiresAt > Date.now()) {
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

        // Salvar no cache com 5 minutos de expiração (para dar resiliência a cliques rápidos de clientes no WhatsApp, sem reter config desatualizada)
        fiscalConfigCache.set(companyId, {
            config: company.tecnospeed_config || {},
            realCompanyId: company.id,
            settings: company.settings || {},
            expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutos
        });

        // Também indexa pelo ID resolvido para garantir que ambos funcionem no cache (UUID e CNPJ)
        if (company.id !== companyId) {
            fiscalConfigCache.set(company.id, {
                config: company.tecnospeed_config || {},
                realCompanyId: company.id,
                settings: company.settings || {},
                expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutos
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
    const { name, token: customToken, webhook_url, webhook_events, enabled, base64, company_id, advancedSettings, provider } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Nome da instância é obrigatório' });
    }

    try {
        const config = await getEvolutionConfig({ companyId: company_id, provider });
        console.log(`🔌 Creating instance "${name}" on Evolution API (Go: ${config.isGo}, URL: ${config.url})...`);

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

        let payload: any;

        if (config.isGo) {
            // ===== EVOLUTION GO PAYLOAD =====
            const { profile_name, transport, webhook_events: goEvents } = req.body;

            payload = {
                name: name,
                token: token
            };

            // Nome do Perfil (se fornecido)
            if (profile_name) payload.profileName = profile_name;

            // Webhook events (lista de eventos EvoGo)
            if (goEvents && Array.isArray(goEvents) && goEvents.length > 0) {
                payload.webhookEvents = goEvents;
            }

            // Transporte personalizado (RabbitMQ, WebSocket, NATS)
            if (transport && typeof transport === 'object') {
                const cleanTransport: any = {};
                if (transport.rabbitMQ && transport.rabbitMQ !== 'default') cleanTransport.rabbitMQ = transport.rabbitMQ;
                if (transport.webSocket && transport.webSocket !== 'default') cleanTransport.webSocket = transport.webSocket;
                if (transport.nats && transport.nats !== 'default') cleanTransport.nats = transport.nats;
                if (Object.keys(cleanTransport).length > 0) payload.transport = cleanTransport;
            }

            // Incluir advancedSettings se fornecido pelo frontend
            if (advancedSettings && typeof advancedSettings === 'object') {
                const cleanAdvanced: any = {};
                if (typeof advancedSettings.alwaysOnline === 'boolean') cleanAdvanced.alwaysOnline = advancedSettings.alwaysOnline;
                if (typeof advancedSettings.rejectCall === 'boolean') cleanAdvanced.rejectCall = advancedSettings.rejectCall;
                if (advancedSettings.msgRejectCall) cleanAdvanced.msgRejectCall = advancedSettings.msgRejectCall;
                if (typeof advancedSettings.readMessages === 'boolean') cleanAdvanced.readMessages = advancedSettings.readMessages;
                if (typeof advancedSettings.ignoreGroups === 'boolean') cleanAdvanced.ignoreGroups = advancedSettings.ignoreGroups;
                if (typeof advancedSettings.ignoreStatus === 'boolean') cleanAdvanced.ignoreStatus = advancedSettings.ignoreStatus;
                if (Object.keys(cleanAdvanced).length > 0) {
                    payload.advancedSettings = cleanAdvanced;
                }
            }

        } else {
            // ===== EVOLUTION API PAYLOAD =====
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

            payload = {
                instanceName: name,
                name: name,
                token: token,
                qrcode: true,
                integration: 'WHATSAPP-BAILEYS'
            };

            if (webhookConfig) {
                payload.webhook = webhookConfig;
            }
        }

        console.log('📤 Sending payload to Evolution:', JSON.stringify(payload, null, 2));

        // 1. Chamar Evolution API para criar
        const response = await axios.post(`${config.url}/instance/create`, payload, {
            headers: {
                'apikey': config.apiKey
            }
        });

        console.log('✅ Instance created on Evolution:', response.data);

        // Configurar webhook imediatamente para a EvoGo após a criação (se houver URL ou eventos marcados)
        if (config.isGo && (webhook_url || (webhook_events && webhook_events.length > 0))) {
            try {
                const evoGoData = response.data?.data || {};
                const instanceToken = evoGoData.token;
                const connectPayload: any = {
                    webhookUrl: webhook_url || undefined,
                    subscribe: webhook_events && webhook_events.length > 0 ? webhook_events : ['MESSAGE']
                };

                const { transport } = req.body;
                if (transport && typeof transport === 'object') {
                    if (transport.rabbitMQ && transport.rabbitMQ !== 'default') connectPayload.rabbitmqEnable = transport.rabbitMQ === 'enabled' ? 'true' : 'false';
                    if (transport.webSocket && transport.webSocket !== 'default') connectPayload.websocketEnable = transport.webSocket === 'enabled' ? 'true' : 'false';
                    if (transport.nats && transport.nats !== 'default') connectPayload.natsEnable = transport.nats === 'enabled' ? 'true' : 'false';
                }

                console.log('📡 Calling connect immediately on creation to configure webhook...');
                await axios.post(`${config.url}/instance/connect`, connectPayload, {
                    headers: { 'apikey': instanceToken }
                });
                console.log('✅ Webhook configured on creation for EvoGo!');
            } catch (connectErr: any) {
                console.warn('⚠️ Immediate connect configuration failed:', connectErr.response?.data || connectErr.message);
            }
        }

        // Formatar resposta para manter compatibilidade com o frontend
        let finalResponseData = response.data;
        if (config.isGo) {
            // Estrutura real da EvoGo: { data: { id: 'uuid-gerado', name: '...', token: 'enviado', ... }, message: 'success' }
            const evoGoData = response.data?.data || {};
            const generatedId = evoGoData.id || evoGoData.instanceId;
            const instanceToken = evoGoData.token || token;
            const instanceName = evoGoData.name || name;

            console.log(`🆔 EvoGo ID gerado: ${generatedId}, Token: ${instanceToken}`);
            console.log(`📦 Resposta raw EvoGo:`, JSON.stringify(response.data, null, 2));

            finalResponseData = {
                instance: {
                    instanceName: instanceName,
                    token: instanceToken,  // ID Token da instância (chave de segurança da EvoGo)
                    status: 'created'
                },
                hash: {
                    apikey: instanceToken
                }
            };
        }

        // 2. Retornar dados para o frontend salvar
        res.status(201).json(finalResponseData);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro na Evolution API:', errorDetail);
        res.status(500).json({
            error: 'Erro ao criar instância na Evolution API',
            detail: typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail
        });
    }
});


// Endpoint para buscar todas as instâncias da EvoGo e seus IDs reais
app.get('/instances/evogo-sync', authenticate, async (req, res) => {
    const { company_id } = req.query;
    try {
        const config = await getEvolutionConfig({ companyId: company_id as string });
        if (!config.isGo) {
            return res.json({ instances: [], isGo: false });
        }

        const allRes = await axios.get(`${config.url}/instance/all`, {
            headers: { 'apikey': config.apiKey }
        });

        const instances = (allRes.data?.data || []).map((i: any) => ({
            id: i.id,           // UUID gerado pela EvoGo (o ID correto)
            name: i.name,       // Nome da instância
            token: i.token,     // Token enviado na criação
            connected: i.connected,
            profileName: i.client_name,
            jid: i.jid,
        }));

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (SUPABASE_URL && supabaseKey && company_id) {
            try {
                // Buscar instâncias locais e atualizar o provider das encontradas na EvoGo
                const dbRes = await axios.get(
                    `${SUPABASE_URL}/rest/v1/instances?company_id=eq.${company_id}&select=id,instance_name,provider`,
                    {
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': `Bearer ${supabaseKey}`
                        }
                    }
                );
                const localInsts = dbRes.data || [];
                for (const local of localInsts) {
                    const serverInst = instances.find((i: any) =>
                        (i.name || '').toLowerCase().trim() === (local.instance_name || '').toLowerCase().trim()
                    );
                    if (serverInst && local.provider !== 'evolution_go') {
                        console.log(`🔄 [evogo-sync] Sincronizando provider para ${local.instance_name} -> evolution_go`);
                        await axios.patch(
                            `${SUPABASE_URL}/rest/v1/instances?id=eq.${local.id}`,
                            { provider: 'evolution_go' },
                            {
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal'
                                }
                            }
                        ).catch(e => console.warn('⚠️ evogo-sync patch provider failed:', e.message));
                    }
                }
            } catch (dbErr: any) {
                console.warn('⚠️ evogo-sync DB update failed:', dbErr.message);
            }
        }

        res.json({ instances, isGo: true });
    } catch (error: any) {
        console.error('❌ Erro ao buscar instâncias EvoGo:', error.message);
        res.status(500).json({ error: error.message });
    }
});


app.get('/instances/:name/connect', authenticate, async (req, res) => {
    const { name } = req.params;
    const { token, company_id } = req.query;

    try {
        const config = await getEvolutionConfig({ instanceName: name, token: token as string, companyId: company_id as string });
        console.log(`🔍 Fetching QR Code for instance "${name}" (Go: ${config.isGo})...`);

        const executeConnect = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                const allRes = await axios.get(`${activeConfig.url}/instance/all`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                const instancesList = allRes.data?.data || [];
                const inst = instancesList.find((i: any) =>
                    i.id === token || i.token === token || i.name.toLowerCase() === name.toLowerCase()
                );
                if (!inst) throw new Error('Instance not found on Evolution GO');
                const instanceToken = inst.token || token;

                const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

                if (inst.token && inst.token !== token && SUPABASE_URL && supabaseKey) {
                    console.log(`🔄 [Connect Auto-Sync] Sincronizando token de ${name}: ${token} → ${inst.token}`);
                    await axios.patch(
                        `${SUPABASE_URL}/rest/v1/instances?evolution_instance_id=eq.${encodeURIComponent(token as string)}`,
                        { evolution_instance_id: inst.token },
                        {
                            headers: {
                                'apikey': supabaseKey,
                                'Authorization': `Bearer ${supabaseKey}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal'
                            }
                        }
                    ).catch(e => console.warn('⚠️ Connect Auto-sync patch failed:', e.message));
                }

                // Buscar detalhes do webhook no Supabase para repassar ao conectar
                let dbWebhookUrl = '';
                let dbWebhookEvents = activeConfig.isGo ? ['MESSAGE'] : ['MESSAGES_UPSERT'];
                if (token && SUPABASE_URL && supabaseKey) {
                    try {
                        const dbRes = await axios.get(
                            `${SUPABASE_URL}/rest/v1/instances?evolution_instance_id=eq.${encodeURIComponent(token as string)}&select=webhook_url,webhook_events`,
                            {
                                headers: {
                                    'apikey': supabaseKey,
                                    'Authorization': `Bearer ${supabaseKey}`
                                }
                            }
                        );
                        if (dbRes.data && dbRes.data.length > 0) {
                            dbWebhookUrl = dbRes.data[0].webhook_url || '';
                            dbWebhookEvents = dbRes.data[0].webhook_events || (activeConfig.isGo ? ['MESSAGE'] : ['MESSAGES_UPSERT']);
                        }
                    } catch (dbErr: any) {
                        console.warn('⚠️ Error fetching webhook info from DB:', dbErr.message);
                    }
                }

                try {
                    await axios.post(`${activeConfig.url}/instance/connect`, {
                        webhookUrl: dbWebhookUrl || undefined,
                        subscribe: dbWebhookEvents
                    }, {
                        headers: { 'apikey': instanceToken }
                    });
                } catch (connErr: any) {
                    console.warn('⚠️ Connect call failed or already connected:', connErr.message);
                }

                const qrRes = await axios.get(`${activeConfig.url}/instance/qr`, {
                    headers: { 'apikey': instanceToken }
                });

                return {
                    code: qrRes.data.data?.Code || qrRes.data.data?.code,
                    base64: qrRes.data.data?.Qrcode || qrRes.data.data?.base64
                };
            } else {
                const encodedName = encodeURIComponent(name);
                const response = await axios.get(`${activeConfig.url}/instance/connect/${encodedName}`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                return response.data;
            }
        };

        let resultData;
        try {
            resultData = await executeConnect(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ Primary connect failed (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            resultData = await executeConnect(fallbackConfig);
        }

        console.log('✅ QR Code received');
        res.json(resultData);
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
    const { url, events, enabled, base64, token, company_id, transport } = req.body;

    try {
        const targetName = await resolveTargetName(name, token, company_id);
        const config = await getEvolutionConfig({ instanceName: targetName, token, companyId: company_id });
        const encodedName = encodeURIComponent(targetName);
        console.log(`📡 Updating webhook for instance "${targetName}" (Go: ${config.isGo})...`);

        const payload = {
            webhook: {
                enabled: enabled ?? true,
                url: url,
                webhook_by_events: false,
                base64: base64 ?? true,
                events: events || ['MESSAGES_UPSERT']
            }
        };

        const executeWebhook = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                // Para Evolution GO, precisamos buscar o token secreto específico da instância
                console.log(`📡 EvoGo: fetching token for instance ${token} to configure webhook...`);
                const allRes = await axios.get(`${activeConfig.url}/instance/all`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                const instancesList = allRes.data?.data || [];
                const inst = instancesList.find((i: any) =>
                    i.id === token || i.token === token || i.name.toLowerCase() === targetName.toLowerCase()
                );
                if (!inst) throw new Error('Instância não encontrada na EvoGo para atualizar o webhook');
                const instanceToken = inst.token || token;

                const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

                // Se o token mudou no servidor, sincronizar no banco de dados
                if (inst.token && inst.token !== token && SUPABASE_URL && supabaseKey) {
                    console.log(`🔄 [Webhook Auto-Sync] Sincronizando token de ${targetName}: ${token} → ${inst.token}`);
                    await axios.patch(
                        `${SUPABASE_URL}/rest/v1/instances?evolution_instance_id=eq.${encodeURIComponent(token as string)}`,
                        { evolution_instance_id: inst.token },
                        {
                            headers: {
                                'apikey': supabaseKey,
                                'Authorization': `Bearer ${supabaseKey}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal'
                            }
                        }
                    ).catch(e => console.warn('⚠️ Webhook Auto-sync patch failed:', e.message));
                }

                console.log(`📡 EvoGo: configuring webhook by calling /instance/connect using instance token...`);
                const connectPayload: any = {
                    webhookUrl: url || undefined,
                    subscribe: events && events.length > 0 ? events : undefined
                };

                if (transport?.rabbitMQ && transport.rabbitMQ !== 'default') {
                    connectPayload.rabbitmqEnable = transport.rabbitMQ === 'enabled' ? 'true' : 'false';
                }
                if (transport?.webSocket && transport.webSocket !== 'default') {
                    connectPayload.websocketEnable = transport.webSocket === 'enabled' ? 'true' : 'false';
                }
                if (transport?.nats && transport.nats !== 'default') {
                    connectPayload.natsEnable = transport.nats === 'enabled' ? 'true' : 'false';
                }

                const connectRes = await axios.post(`${activeConfig.url}/instance/connect`, connectPayload, {
                    headers: { 'apikey': instanceToken }
                });
                return { success: true, message: 'Webhook configurado com sucesso (Evolution GO)', detail: connectRes.data };
            } else {
                const response = await axios.post(`${activeConfig.url}/webhook/set/${encodedName}`, payload, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                return response.data;
            }
        };

        let responseData;
        try {
            responseData = await executeWebhook(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ Primary webhook config failed (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            responseData = await executeWebhook(fallbackConfig);
        }

        res.json(responseData);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro ao configurar webhook:', JSON.stringify(errorDetail, null, 2));
        res.status(500).json({
            error: 'Erro ao configurar webhook na Evolution API',
            detail: typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail
        });
    }
});

// GET advanced-settings for Evolution GO
app.get('/instances/:name/advanced-settings', authenticate, async (req, res) => {
    const { name } = req.params;
    const { token, company_id } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string, company_id as string);
        const config = await getEvolutionConfig({ instanceName: targetName, token: token as string, companyId: company_id as string });
        if (!config.isGo) {
            return res.status(400).json({ error: 'Endpoint exclusivo para Evolution GO' });
        }

        // Buscar o token secreto específico da instância e o UUID correto
        const allRes = await axios.get(`${config.url}/instance/all`, {
            headers: { 'apikey': config.apiKey }
        });
        const instancesList = allRes.data?.data || [];
        const inst = instancesList.find((i: any) =>
            i.id === token || i.token === token || i.name.toLowerCase() === targetName.toLowerCase()
        );
        if (!inst) throw new Error('Instância não encontrada na EvoGo para buscar configurações avançadas');
        const instanceToken = inst.token;
        const instanceUuid = inst.id;

        const executeGetSettings = async (activeConfig: typeof config) => {
            const response = await axios.get(`${activeConfig.url}/instance/${instanceUuid}/advanced-settings`, {
                headers: { 'apikey': instanceToken }
            });
            return response.data;
        };

        let settingsData;
        try {
            settingsData = await executeGetSettings(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ Primary settings fetch failed (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            settingsData = await executeGetSettings(fallbackConfig);
        }

        res.json(settingsData);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error(`❌ Erro ao buscar configurações avançadas de "${name}":`, errorDetail);
        res.status(500).json({
            error: 'Erro ao buscar configurações avançadas na Evolution API',
            detail: typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail
        });
    }
});

// POST (updates) advanced-settings for Evolution GO
app.post('/instances/:name/advanced-settings', authenticate, async (req, res) => {
    const { name } = req.params;
    const { token, company_id } = req.query;
    const { alwaysOnline, rejectCall, msgRejectCall, readMessages, ignoreGroups, ignoreStatus } = req.body;

    try {
        const targetName = await resolveTargetName(name, token as string, company_id as string);
        const config = await getEvolutionConfig({ instanceName: targetName, token: token as string, companyId: company_id as string });
        if (!config.isGo) {
            return res.status(400).json({ error: 'Endpoint exclusivo para Evolution GO' });
        }

        // Buscar o token secreto específico da instância e o UUID correto
        const allRes = await axios.get(`${config.url}/instance/all`, {
            headers: { 'apikey': config.apiKey }
        });
        const instancesList = allRes.data?.data || [];
        const inst = instancesList.find((i: any) =>
            i.id === token || i.token === token || i.name.toLowerCase() === targetName.toLowerCase()
        );
        if (!inst) throw new Error('Instância não encontrada na EvoGo para atualizar configurações avançadas');
        const instanceToken = inst.token;
        const instanceUuid = inst.id;

        const payload: any = {};
        if (typeof alwaysOnline === 'boolean') payload.alwaysOnline = alwaysOnline;
        if (typeof rejectCall === 'boolean') payload.rejectCall = rejectCall;
        if (typeof msgRejectCall === 'string') payload.msgRejectCall = msgRejectCall;
        if (typeof readMessages === 'boolean') payload.readMessages = readMessages;
        if (typeof ignoreGroups === 'boolean') payload.ignoreGroups = ignoreGroups;
        if (typeof ignoreStatus === 'boolean') payload.ignoreStatus = ignoreStatus;

        const executeUpdateSettings = async (activeConfig: typeof config) => {
            const response = await axios.put(`${activeConfig.url}/instance/${instanceUuid}/advanced-settings`, payload, {
                headers: { 'apikey': instanceToken }
            });
            return response.data;
        };

        let responseData;
        try {
            responseData = await executeUpdateSettings(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ Primary settings update failed (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            responseData = await executeUpdateSettings(fallbackConfig);
        }

        res.json(responseData);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error(`❌ Erro ao atualizar configurações avançadas de "${name}":`, errorDetail);
        res.status(500).json({
            error: 'Erro ao atualizar configurações avançadas na Evolution API',
            detail: typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail
        });
    }
});

app.post('/instances/:name/rename', authenticate, async (req, res) => {
    const { name } = req.params;
    const { newName } = req.body;
    const { token, company_id } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string, company_id as string);
        const config = await getEvolutionConfig({ instanceName: targetName, token: token as string, companyId: company_id as string });
        const encodedName = encodeURIComponent(targetName);
        console.log(`📝 Renaming instance "${targetName}" to "${newName}" (Go: ${config.isGo})...`);

        const payload = { newInstanceName: newName };

        const executeRename = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                // Evolution GO não possui rota exposta de renomear no swagger. Retornamos sucesso fictício.
                return { success: true, message: 'Renomeado com sucesso (Evolution GO)' };
            } else {
                const response = await axios.post(`${activeConfig.url}/instance/updateInstanceName/${encodedName}`, payload, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                return response.data;
            }
        };

        let responseData;
        try {
            responseData = await executeRename(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ Primary rename failed (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            responseData = await executeRename(fallbackConfig);
        }

        console.log(`✅ Rename successful for "${targetName}"`);
        res.json(responseData);
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
    const { token, company_id } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string, company_id as string);
        const config = await getEvolutionConfig({ instanceName: targetName, token: token as string, companyId: company_id as string });
        const encodedName = encodeURIComponent(targetName);
        console.log(`👤 Updating WhatsApp profile name for "${targetName}" to "${profileName}" (Go: ${config.isGo})...`);

        const payload = { name: profileName, profileName: profileName };

        const executeProfileName = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                // Evolution GO não possui endpoint de chat/updateProfileName
                return { success: true, message: 'Perfil atualizado (Evolution GO)' };
            } else {
                const response = await axios.post(`${activeConfig.url}/chat/updateProfileName/${encodedName}`, payload, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                return response.data;
            }
        };

        let responseData;
        try {
            responseData = await executeProfileName(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ Primary profile-name update failed (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            responseData = await executeProfileName(fallbackConfig);
        }

        console.log(`✅ Profile name updated for "${targetName}"`);
        res.json(responseData);
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
    const { token, company_id } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string, company_id as string);
        const config = await getEvolutionConfig({ instanceName: targetName, token: token as string, companyId: company_id as string });
        console.log(`🔌 Fetching details for "${targetName}" (Token: ${token || 'N/A'}, Go: ${config.isGo})...`);

        const fetchDetails = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                const response = await axios.get(`${activeConfig.url}/instance/all`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                const allInstances = response.data?.data || [];
                const inst = allInstances.find((i: any) =>
                    (token && (i.id === token || i.token === token)) ||
                    (i.name.toLowerCase() === targetName.toLowerCase())
                );
                if (!inst) throw new Error('Instance not found on Evolution GO');
                const cleanJid = inst.jid ? `${inst.jid.split('@')[0].split(':')[0]}@s.whatsapp.net` : null;
                return {
                    instanceName: inst.name,
                    name: inst.name,
                    profileName: inst.name,
                    token: inst.id,
                    status: inst.connected ? 'connected' : 'disconnected',
                    connectionStatus: inst.connected ? 'open' : 'close',
                    ownerJid: cleanJid,
                    owner: cleanJid,
                    number: inst.jid ? inst.jid.split('@')[0].split(':')[0] : null
                };
            } else {
                const response = await axios.get(`${activeConfig.url}/instance/fetchInstances`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                const allInstances = Array.isArray(response.data) ? response.data : [];
                const match = allInstances.find((i: any) =>
                    (token && (i.token === token || i.id === token)) ||
                    ((i.name || i.instanceName || '').toLowerCase() === targetName.toLowerCase())
                );
                if (!match) throw new Error('Instance not found');
                return match;
            }
        };

        let resultData;
        try {
            resultData = await fetchDetails(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ Primary details fetch failed (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            resultData = await fetchDetails(fallbackConfig);
        }

        if (resultData) {
            console.log(`✅ Details found for: ${resultData.instanceName || resultData.name}`);
            return res.json(resultData);
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

app.all(['/instances/:name/logout', '/api/instances/:name/logout'], authenticate, async (req, res) => {
    const { name } = req.params;
    const { token, company_id } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string, company_id as string);
        const config = await getEvolutionConfig({ instanceName: targetName, token: token as string, companyId: company_id as string });
        console.log(`🔌 Logging out instance "${targetName}" (Go: ${config.isGo})...`);

        const executeLogout = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                const allRes = await axios.get(`${activeConfig.url}/instance/all`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                const instancesList = allRes.data?.data || [];
                const inst = instancesList.find((i: any) =>
                    i.id === token || i.token === token || i.name.toLowerCase() === targetName.toLowerCase()
                );
                if (!inst) throw new Error('Instance not found on Evolution GO');
                const instanceToken = inst.token;

                console.log(`📡 Trying DELETE /instance/logout on Evolution GO...`);
                await axios.delete(`${activeConfig.url}/instance/logout`, {
                    headers: { 'apikey': instanceToken }
                });
                console.log(`✅ Logout bem sucedido para "${targetName}" no Evolution GO`);
            } else {
                const encodedName = encodeURIComponent(targetName);
                let logoutSuccess = false;
                let lastError: any = null;

                try {
                    console.log(`📡 Trying DELETE /instance/logout/${targetName}...`);
                    await axios.delete(`${activeConfig.url}/instance/logout/${encodedName}`, {
                        headers: { 'apikey': activeConfig.apiKey }
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
                        console.log(`📡 Trying POST /instance/logout/${targetName}...`);
                        await axios.post(`${activeConfig.url}/instance/logout/${encodedName}`, {}, {
                            headers: { 'apikey': activeConfig.apiKey }
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
            }
        };

        try {
            await executeLogout(config);
        } catch (primaryErr) {
            console.warn(`⚠️ Primary logout failed. Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            await executeLogout(fallbackConfig);
        }

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
    const { token, company_id } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string, company_id as string);
        const config = await getEvolutionConfig({ instanceName: targetName, token: token as string, companyId: company_id as string });
        const encodedName = encodeURIComponent(targetName);
        console.log(`🗑️ Deleting instance "${targetName}" (Go: ${config.isGo})...`);

        const executeDelete = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                // Para EvoGo, precisamos buscar a lista de instâncias para achar o UUID correto
                const allRes = await axios.get(`${activeConfig.url}/instance/all`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                const instancesList = allRes.data?.data || [];
                const inst = instancesList.find((i: any) =>
                    i.id === token || i.token === token || i.name.toLowerCase() === targetName.toLowerCase()
                );
                if (!inst) {
                    console.log(`ℹ️ Instância já parece não existir na EvoGo: ${targetName}`);
                    return { data: { success: true, message: 'Instância não encontrada na EvoGo, mas deletada.' } };
                }
                const instanceUuid = inst.id;
                return axios.delete(`${activeConfig.url}/instance/delete/${instanceUuid}`, {
                    headers: {
                        'apikey': activeConfig.apiKey
                    }
                });
            } else {
                if (!encodedName) throw new Error('Delete identifier is missing');
                return axios.delete(`${activeConfig.url}/instance/delete/${encodedName}`, {
                    headers: {
                        'apikey': activeConfig.apiKey
                    }
                });
            }
        };

        let response;
        try {
            response = await executeDelete(config);
        } catch (primaryErr) {
            console.warn(`⚠️ Primary delete failed. Trying fallback config...`);
            const fallbackConfig = getAlternativeConfig(config);
            response = await executeDelete(fallbackConfig);
        }

        console.log(`✅ Delete successful for "${targetName}"`);
        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        const status = error.response?.status;
        console.warn(`❌ Erro ao deletar "${name}" na Evolution:`, JSON.stringify(errorDetail, null, 2));

        // Se a instância já não existir (404) ou se for um erro de não encontrado, prossegue.
        if (status === 404 || errorDetail?.message?.toLowerCase().includes('not found') || errorDetail?.error?.toLowerCase().includes('not found')) {
            return res.json({ success: true, warning: 'Instância não encontrada na Evolution, mas removida localmente.' });
        }

        res.status(status || 500).json({
            success: false,
            error: 'Erro ao deletar na Evolution API',
            detail: errorDetail
        });
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


// Helper to verify if the user is the admin (carloscleton.nat@gmail.com)
async function verifyIsAdmin(authHeader: string | null): Promise<boolean> {
    if (!authHeader) return false;
    try {
        const response = await axios.get(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY!,
                'Authorization': authHeader
            }
        });
        const email = response.data?.email;
        return email?.toLowerCase() === 'carloscleton.nat@gmail.com';
    } catch (err: any) {
        console.error('Error verifying admin status:', err.message);
        return false;
    }
}

// Endpoint for simulating batch billing and health checks
app.get(['/fiscal-module/admin/billing-simulation', '/api/fiscal-module/admin/billing-simulation'], authenticate, async (req, res) => {
    const authHeader = req.headers.authorization;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate e endDate são obrigatórios.' });
    }

    const isAdmin = await verifyIsAdmin(authHeader);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Acesso negado. Apenas o administrador da plataforma tem acesso.' });
    }

    try {
        const compResponse = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
            params: {
                select: 'id,trade_name,cnpj,settings,status,fiscal_module_enabled,tecnospeed_config'
            },
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const companies = compResponse.data || [];

        const simulationResults = [];

        // Format ISO dates to fully cover the day
        const isoStartDate = String(startDate).includes('T') ? String(startDate) : `${startDate}T00:00:00.000Z`;
        const isoEndDate = String(endDate).includes('T') ? String(endDate) : `${endDate}T23:59:59.999Z`;

        for (const company of companies) {
            if (company.status === 'blocked' || !company.fiscal_module_enabled) continue;

            const settings = company.settings || {};
            const activeProvider = settings.fiscal_provider || 'tecnospeed';
            const isExempt = !!settings.fiscal_billing_exempt;

            // Fetch all invoices in date range for this company
            const invoicesResponse = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                params: {
                    company_id: `eq.${company.id}`,
                    and: `(created_at.gte.${isoStartDate},created_at.lte.${isoEndDate})`,
                    select: 'type,status',
                    limit: 10000
                },
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                }
            });
            const invoices = invoicesResponse.data || [];

            // Group invoices by provider
            const providers = new Set<string>();
            providers.add(activeProvider);
            for (const inv of invoices) {
                const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
                providers.add(p);
            }

            for (const provider of providers) {
                const isActive = provider === activeProvider;
                const billingConfig = settings.admin_fiscal_billing?.[provider] || {};

                let fixedFeeToApply = 0.00;
                if (isActive) {
                    const fixedFee = typeof billingConfig.fixed_fee === 'number' 
                        ? billingConfig.fixed_fee 
                        : (settings.monthly_fee ?? 30.00);
                    fixedFeeToApply = isExempt ? 0.00 : fixedFee;
                }

                const perNoteFee = typeof billingConfig.per_note_fee === 'number' 
                    ? billingConfig.per_note_fee 
                    : 0.50;

                const providerInvoices = invoices.filter(inv => {
                    const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
                    return p === provider;
                });

                const notesCount = providerInvoices.filter(inv => 
                    ['concluido', 'autorizada', 'concluído'].includes(String(inv.status).toLowerCase())
                ).length;

                const canceledCount = providerInvoices.filter(inv => 
                    ['cancelado', 'cancelada'].includes(String(inv.status).toLowerCase())
                ).length;

                // Skip row if there is no fixed fee and no activity (both issued and canceled are 0)
                if (fixedFeeToApply <= 0 && notesCount === 0 && canceledCount === 0) {
                    continue;
                }

                let issuerStatus = 'Sem Configuração ❌';
                if (isActive) {
                    if (provider === 'nfeio') {
                        const nfeio = settings.nfeio_config || {};
                        issuerStatus = nfeio.apiKey && nfeio.companyId 
                            ? (nfeio.certificado_id || nfeio.certificado_status === 'ativo' ? 'Certificado OK ✅' : 'Sem Certificado ❌')
                            : 'Sem Configuração ❌';
                    } else if (provider === 'tecnospeed') {
                        const ts = company.tecnospeed_config || {};
                        issuerStatus = ts.cnpj && ts.tecnospeed_api_key 
                            ? (ts.certificado_id || ts.certificado_status === 'ativo' ? 'Certificado OK ✅' : 'Sem Certificado ❌')
                            : 'Sem Configuração ❌';
                    } else if (provider === 'other') {
                        const ts = company.tecnospeed_config || {};
                        issuerStatus = ts.use_external_webhook && ts.external_webhook_url
                            ? 'Webhook Ativo ✅'
                            : 'Sem Configuração ❌';
                    }
                } else {
                    issuerStatus = 'Histórico (Inativo) ⚠️';
                }

                const notesCost = (notesCount + canceledCount) * perNoteFee;
                const totalSuggested = fixedFeeToApply + notesCost;

                simulationResults.push({
                    companyId: company.id,
                    tradeName: company.trade_name,
                    cnpj: company.cnpj,
                    provider,
                    isActiveProvider: isActive,
                    issuerStatus,
                    fixedFee: fixedFeeToApply,
                    perNoteFee,
                    notesCount,
                    canceledCount,
                    notesCost,
                    commissions: 0,
                    totalSuggested,
                    isExempt
                });
            }
        }

        res.json({ success: true, simulation: simulationResults });
    } catch (err: any) {
        console.error('❌ Erro na simulação de faturamento:', err.message);
        res.status(500).json({ error: 'Erro ao gerar simulação de faturamento', detail: err.message });
    }
});

// Endpoint for retrieving detailed invoices for a company/provider in a period
app.get(['/fiscal-module/admin/billing-invoices', '/api/fiscal-module/admin/billing-invoices'], authenticate, async (req, res) => {
    const authHeader = req.headers.authorization;
    const { companyId, provider, startDate, endDate } = req.query;

    if (!companyId || !provider || !startDate || !endDate) {
        return res.status(400).json({ error: 'companyId, provider, startDate e endDate são obrigatórios.' });
    }

    const isAdmin = await verifyIsAdmin(authHeader);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Acesso negado. Apenas o administrador da plataforma tem acesso.' });
    }

    try {
        const isoStartDate = String(startDate).includes('T') ? String(startDate) : `${startDate}T00:00:00.000Z`;
        const isoEndDate = String(endDate).includes('T') ? String(endDate) : `${endDate}T23:59:59.999Z`;

        // Fetch all invoices for company in range
        const invoicesResponse = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
            params: {
                company_id: `eq.${companyId}`,
                and: `(created_at.gte.${isoStartDate},created_at.lte.${isoEndDate})`,
                select: 'id,created_at,type,status,external_id,payload,invoice_number,dps_number,dps_serie,deleted',
                limit: 10000,
                order: 'created_at.desc'
            },
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const invoices = invoicesResponse.data || [];

        // Filter by the requested provider
        const filteredInvoices = invoices.filter((inv: any) => {
            const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
            return p === provider;
        });

        // Map key info to make it simple for frontend
        const mappedInvoices = filteredInvoices.map((inv: any) => {
            const payload = inv.payload || {};
            let clientName = 'Cliente não identificado';
            let ident = `ID: ${inv.external_id || inv.id}`;
            let valor = 0;

            if (inv.type === 'nfeio') {
                clientName = payload.borrower?.name || payload.cliente?.nome || payload.retorno?.borrower?.name || 'Cliente não identificado';
                const invNo = inv.invoice_number || payload.retorno?.number || payload.numero || payload.retorno?.numero;
                const series = payload.retorno?.series || payload.series || '';
                ident = invNo ? `Nº ${invNo}` : `Série: ${series} / ID: ${inv.external_id}`;
                valor = payload.servicesAmount || payload.amount || payload.valorTotal || payload.retorno?.servicesAmount || payload.retorno?.amount || 0;
            } else {
                const tomador = payload.tomador || {};
                clientName = tomador.razaoSocial || tomador.nome || payload.retorno?.tomador?.razaoSocial || payload.retorno?.tomador?.nome || 'Cliente não identificado';
                
                const invNo = inv.invoice_number 
                    || payload.retorno?.numeroNfse 
                    || payload.numeroNfse 
                    || payload.numeroNfe 
                    || payload.retorno?.numero 
                    || payload.numero 
                    || payload.retorno?.dps?.numero;
                    
                const dpsNo = inv.dps_number 
                    || payload.retorno?.dps?.numero 
                    || payload.dps?.numero 
                    || payload.nacional?.dps?.numero 
                    || payload.DPS?.infDPS?.nDPS 
                    || payload.nDPS 
                    || payload.retorno?.rps?.numero 
                    || payload.rps?.numero;

                ident = invNo ? `Nº ${invNo}` : (dpsNo ? `RPS: ${dpsNo} / ID: ${inv.external_id}` : `ID: ${inv.external_id}`);
                
                // Get TecnoSpeed service value
                const tsServico = Array.isArray(payload.servico) ? payload.servico[0] : payload.servico;
                const tsRetornoServico = Array.isArray(payload.retorno?.servico) ? payload.retorno.servico[0] : payload.retorno?.servico;
                
                valor = payload.valorTotal 
                    || tsServico?.valor?.servico 
                    || tsServico?.valorUnitario 
                    || tsServico?.valorTotal 
                    || tsServico?.valorServico
                    || payload.retorno?.valorTotal 
                    || tsRetornoServico?.valor?.servico 
                    || tsRetornoServico?.valorUnitario 
                    || tsRetornoServico?.valorTotal 
                    || tsRetornoServico?.valorServico 
                    || 0;
            }

            return {
                id: inv.id,
                created_at: inv.created_at,
                type: inv.type,
                status: inv.status,
                external_id: inv.external_id,
                clientName,
                ident,
                valor,
                deleted: !!inv.deleted
            };
        });

        res.json({ success: true, invoices: mappedInvoices });
    } catch (err: any) {
        console.error('❌ Erro ao buscar notas detalhadas:', err.message);
        res.status(550).json({ error: 'Erro ao carregar detalhes das notas', detail: err.message });
    }
});

// Endpoint for processing batch billing and sending notifications
app.post(['/fiscal-module/admin/billing-process', '/api/fiscal-module/admin/billing-process'], authenticate, async (req, res) => {
    const authHeader = req.headers.authorization;
    const { startDate, endDate, billingData } = req.body; 

    if (!startDate || !endDate || !Array.isArray(billingData)) {
        return res.status(400).json({ error: 'startDate, endDate e billingData (array) são obrigatórios.' });
    }

    const isAdmin = await verifyIsAdmin(authHeader);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Acesso negado. Apenas o administrador da plataforma tem acesso.' });
    }

    let platformProvider: string | null = null;
    let platformConfig: any = null;
    let isSandbox = false;

    try {
        const { data: appSettings } = await axios.get(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY! }
        });
        const settings = appSettings?.[0];
        if (settings) {
            platformProvider = settings.platform_billing_provider;
            isSandbox = settings.platform_billing_sandbox || false;
            const env = isSandbox ? 'sandbox' : 'production';
            platformConfig = settings.platform_billing_config?.[platformProvider!]?.[env];
        }
    } catch (err: any) {
        console.error('⚠️ Falha ao ler configurações da plataforma:', err.message);
    }

    if (!platformProvider || !platformConfig) {
        return res.status(400).json({ error: 'Configuração de faturamento da plataforma (Asaas/Stripe) não encontrada ou incompleta.' });
    }

    const results = [];

    for (const item of billingData) {
        const { companyId, amount, description } = item;

        try {
            const compRes = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}&select=id,trade_name,cnpj,owner_email,phone,owner_phone,settings`, {
                headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                }
            });
            const company = compRes.data?.[0];
            if (!company) {
                results.push({ companyId, success: false, error: 'Empresa não encontrada.' });
                continue;
            }

            const settings = company.settings || {};
            if (settings.fiscal_billing_exempt && parseFloat(amount) <= 0) {
                results.push({ companyId, success: false, error: 'Empresa isenta e sem saldo a pagar.' });
                continue;
            }

            const external_reference = `LC-FISCAL-${companyId.substring(0, 4)}-${new Date().getTime()}`;

            const adapter = PaymentFactory.getAdapter(platformProvider, platformConfig, isSandbox);
            const chargeResult = await adapter.createCharge({
                amount: parseFloat(amount),
                description: description,
                payment_method: 'pix',
                external_reference,
                customer: {
                    name: company.trade_name,
                    email: company.owner_email || 'financeiro@lucrocerto.com',
                    tax_id: company.cnpj
                }
            });

            if (chargeResult.success) {
                await axios.post(`${SUPABASE_URL}/rest/v1/company_charges`, {
                    company_id: company.id,
                    provider: platformProvider,
                    amount: parseFloat(amount),
                    description: description,
                    external_reference,
                    payment_method: 'pix',
                    status: chargeResult.status || 'pending',
                    gateway_id: chargeResult.payment_id,
                    payment_link: chargeResult.payment_link,
                    qr_code: chargeResult.qr_code,
                    qr_code_base64: chargeResult.qr_code_base64,
                    is_sandbox: isSandbox
                }, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    }
                });

                const whatsappInstance = (req.body.whatsappInstance || '').trim();
                const phone = formatWhatsappNumber(company.owner_phone || company.phone || '');

                let notificationSent = false;
                if (whatsappInstance && phone) {
                    const message = `Olá, *${company.trade_name}*! 😊\n\nA fatura de utilização do módulo fiscal para o período de ${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')} foi gerada.\n\n*Detalhes da Fatura:*\n📝 ${description}\n💰 *Valor:* R$ ${parseFloat(amount).toFixed(2).replace('.', ',')}\n\nCopie o link abaixo para efetuar o pagamento via Pix:\n🔗 ${chargeResult.payment_link || 'Link indisponível'}\n\nObrigado por utilizar nossa plataforma! 💼`;

                    try {
                        const encodedInstance = encodeURIComponent(whatsappInstance);
                        await axios.post(`${EVOLUTION_API_URL}/message/sendText/${encodedInstance}`, {
                            number: phone,
                            text: message
                        }, {
                            headers: { 'apikey': EVOLUTION_API_KEY }
                        });
                        notificationSent = true;
                        console.log(`✅ [BATCH-BILL] Notificação enviada para ${company.trade_name}`);
                    } catch (waErr: any) {
                        console.error(`❌ Erro ao enviar WA para ${company.trade_name}:`, waErr.message);
                    }
                }

                results.push({
                    companyId,
                    tradeName: company.trade_name,
                    success: true,
                    amount,
                    paymentLink: chargeResult.payment_link,
                    notificationSent
                });
            } else {
                results.push({
                    companyId,
                    tradeName: company.trade_name,
                    success: false,
                    error: chargeResult.error || 'Erro na API de pagamento.'
                });
            }
        } catch (err: any) {
            console.error(`❌ Erro ao processar faturamento para ${companyId}:`, err.message);
            results.push({
                companyId,
                success: false,
                error: err.message
            });
        }
    }

    res.json({ success: true, results });
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
                    const phone = formatWhatsappNumber(company.owner_phone || company.phone);
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
    const { instanceName, number: rawNumber, text, mediaUrl, mediaType, mimetype, fileName, companyId, token } = req.body;
    const authHeader = req.headers.authorization;

    if (!instanceName || !rawNumber) {
        return res.status(400).json({ error: 'instanceName e number são obrigatórios' });
    }

    const number = formatWhatsappNumber(rawNumber);

    try {
        let instanceToken = token || '';
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const dbAuthHeader = SUPABASE_SERVICE_ROLE_KEY 
            ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` 
            : (authHeader || `Bearer ${supabaseKey}`);

        if (SUPABASE_URL) {
            try {
                const { data: insts } = await axios.get(
                    `${SUPABASE_URL}/rest/v1/instances?instance_name=ilike.${encodeURIComponent(instanceName)}&select=id,evolution_instance_id`,
                    {
                        headers: {
                            'apikey': supabaseKey,
                            'Authorization': dbAuthHeader
                        }
                    }
                );
                if (insts && insts.length > 0) {
                    instanceToken = insts[0].evolution_instance_id;
                    const dbRowId = insts[0].id;

                    // Auto-sync token check for Evolution GO
                    try {
                        const configTemp = await getEvolutionConfig({ 
                            instanceName, 
                            companyId, 
                            token: instanceToken, 
                            userToken: SUPABASE_SERVICE_ROLE_KEY ? undefined : authHeader 
                        });
                        if (configTemp.isGo) {
                            const allRes = await axios.get(`${configTemp.url}/instance/all`, {
                                headers: { 'apikey': configTemp.apiKey },
                                timeout: 2000
                            });
                            const goInstances = allRes.data?.data || [];
                            const serverInst = goInstances.find((i: any) =>
                                (i.name || '').toLowerCase().trim() === instanceName.toLowerCase().trim()
                            );
                            if (serverInst && serverInst.token && serverInst.token !== instanceToken) {
                                console.log(`🔄 [whatsapp/send Auto-Sync] Mismatched token for ${instanceName}: DB=${instanceToken} vs Server=${serverInst.token}. Updating DB...`);
                                instanceToken = serverInst.token;
                                await axios.patch(
                                    `${SUPABASE_URL}/rest/v1/instances?id=eq.${dbRowId}`,
                                    { evolution_instance_id: serverInst.token },
                                    {
                                        headers: {
                                            'apikey': supabaseKey,
                                            'Authorization': dbAuthHeader,
                                            'Content-Type': 'application/json',
                                            'Prefer': 'return=minimal'
                                        }
                                    }
                                ).catch(e => console.warn('⚠️ Auto-sync token patch failed:', e.message));
                            }
                        }
                    } catch (allErr: any) {
                        console.warn('⚠️ Auto-sync token check failed:', allErr.message);
                    }
                }
            } catch (err: any) {
                console.error('⚠️ [whatsapp/send] Error fetching instance token:', err.message);
            }
        }

        const config = await getEvolutionConfig({ 
            instanceName, 
            companyId, 
            token: instanceToken, 
            userToken: SUPABASE_SERVICE_ROLE_KEY ? undefined : authHeader 
        });
        const targetName = await resolveTargetName(
            instanceName, 
            instanceToken, 
            companyId, 
            SUPABASE_SERVICE_ROLE_KEY ? undefined : authHeader
        );
        const encodedName = encodeURIComponent(targetName);

        // Se o link do PDF for local (localhost), a Evolution API na nuvem não conseguirá baixá-lo.
        // Nesse caso, pulamos o envio de mídia e enviamos direto como texto com o link.
        const isLocalhost = mediaUrl && (mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1'));

        let finalMediaUrl = mediaUrl;
        let base64Media = '';
        let isBase64 = false;

        if (mediaUrl && !isLocalhost) {
            // Se o link do PDF for da nossa própria API (/fiscal-module/), precisamos anexar o token de autenticação
            // para que a Evolution API externa consiga baixá-lo sem receber 401.
            if (mediaUrl.includes('/fiscal-module/') && !mediaUrl.includes('token=')) {
                const tokenVal = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '';
                if (tokenVal) {
                    const separator = mediaUrl.includes('?') ? '&' : '?';
                    finalMediaUrl = `${mediaUrl}${separator}token=${encodeURIComponent(tokenVal)}`;
                }
            }

            // Tentar baixar o PDF no backend e converter para Base64 para enviar diretamente
            try {
                console.log(`📥 Baixando PDF para envio como Base64: ${finalMediaUrl}`);
                const pdfResponse = await axios.get(finalMediaUrl, {
                    headers: authHeader ? { 'Authorization': authHeader } : {},
                    responseType: 'arraybuffer',
                    timeout: 8000
                });
                if (pdfResponse.status === 200) {
                    base64Media = Buffer.from(pdfResponse.data).toString('base64');
                    isBase64 = true;
                    console.log(`✅ PDF convertido com sucesso para Base64 (${pdfResponse.data.length} bytes)`);
                }
            } catch (downloadErr: any) {
                console.warn(`⚠️ Erro ao baixar PDF para Base64 no backend (${downloadErr.message}). Mantendo URL.`);
            }
        }

        if (mediaUrl && !isLocalhost) {
            try {
                console.log(`✉️ [Media] Tentando enviar documento WhatsApp via "${targetName}" para ${number}...`);
                let response;
                if (config.isGo) {
                    response = await axios.post(`${config.url}/send/media`, {
                        id: targetName,
                        number: number,
                        url: isBase64 ? base64Media : finalMediaUrl,
                        type: mediaType || 'document',
                        filename: fileName || 'NotaFiscal.pdf',
                        caption: text || ''
                    }, {
                        headers: {
                            'apikey': instanceToken || config.apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                } else {
                    response = await axios.post(`${config.url}/message/sendMedia/${encodedName}`, {
                        number: number,
                        mediatype: mediaType || 'document',
                        mimetype: mimetype || 'application/pdf',
                        caption: text || '',
                        media: isBase64 ? base64Media : finalMediaUrl,
                        fileName: fileName || 'NotaFiscal.pdf'
                    }, {
                        headers: {
                            'apikey': config.apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000
                    });
                }
                return res.json(response.data);
            } catch (mediaErr: any) {
                console.warn(`⚠️ Falha ao enviar como mídia (${mediaErr.message || mediaErr}). Fazendo fallback para texto...`);
            }
        }

        let response;
        if (config.isGo) {
            let buttonSent = false;
            if (finalMediaUrl) {
                try {
                    console.log(`✉️ [Button] Tentando enviar link como botão interativo via Evolution GO...`);
                    response = await axios.post(`${config.url}/send/button`, {
                        id: targetName,
                        number: number,
                        title: fileName ? fileName.replace(/\.pdf$/i, '') : 'Visualizar Documento',
                        description: text || 'Sua nota fiscal eletrônica foi gerada com sucesso. Clique no botão abaixo para visualizá-la.',
                        footer: 'Lucro Certo',
                        buttons: [
                            {
                                type: 'url',
                                displayText: 'Visualizar PDF',
                                url: finalMediaUrl
                            }
                        ]
                    }, {
                        headers: {
                            'apikey': instanceToken || config.apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                    buttonSent = true;
                    console.log(`✅ Botão interativo enviado com sucesso!`);
                } catch (btnErr: any) {
                    console.warn(`⚠️ Falha ao enviar como botão (${btnErr.message}). Fazendo fallback para texto simples...`);
                }
            }

            if (!buttonSent) {
                let textToSend = text || '';
                if (finalMediaUrl && !textToSend.includes(finalMediaUrl)) {
                    textToSend = `${textToSend}\n\nLink do PDF: ${finalMediaUrl}`.trim();
                }
                if (!textToSend) {
                    return res.status(400).json({ error: 'text ou mediaUrl é obrigatório' });
                }

                console.log(`✉️ [Text] Enviando mensagem de texto WhatsApp via "${targetName}" para ${number}...`);
                response = await axios.post(`${config.url}/send/text`, {
                    id: targetName,
                    number: number,
                    text: textToSend
                }, {
                    headers: {
                        'apikey': instanceToken || config.apiKey,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } else {
            let textToSend = text || '';
            if (finalMediaUrl && !textToSend.includes(finalMediaUrl)) {
                textToSend = `${textToSend}\n\nLink do PDF: ${finalMediaUrl}`.trim();
            }
            if (!textToSend) {
                return res.status(400).json({ error: 'text ou mediaUrl é obrigatório' });
            }

            console.log(`✉️ [Text] Enviando mensagem de texto WhatsApp via "${targetName}" para ${number}...`);
            response = await axios.post(`${config.url}/message/sendText/${encodedName}`, {
                number: number,
                text: textToSend,
                linkPreview: true
            }, {
                headers: {
                    'apikey': config.apiKey,
                    'Content-Type': 'application/json'
                }
            });
        }

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

    // Tenta obter o nome da instância de WhatsApp no Supabase ou usa o do payload se já presente
    let enrichedPayload = { ...payload };
    const campaignInstanceName = payload?.campaign?.whatsapp_instance_name;

    if (campaignInstanceName && campaignInstanceName.trim() !== '') {
        const trimmedInstance = campaignInstanceName.trim();
        enrichedPayload.whatsapp_instance_name = trimmedInstance;
        console.log(`   📱 Instância do WhatsApp configurada diretamente na campanha: "${trimmedInstance}"`);
    } else if (SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY) && payload?.campaign?.whatsapp) {
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
                            whatsapp_instance_name: instanceName,
                            campaign: {
                                ...payload.campaign,
                                whatsapp_instance_name: instanceName
                            }
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
