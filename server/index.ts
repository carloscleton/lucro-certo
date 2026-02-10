import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { PaymentFactory } from './services/payments/PaymentFactory.js';

dotenv.config();
dotenv.config({ path: '../.env' }); // Fallback para o .env da raiz do projeto

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'x-api-key'],
}));
app.use(express.json());

// Evolution API Config
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL?.trim();
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY?.trim();

// Supabase Config for Fiscal Proxy
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();

if (!EVOLUTION_API_URL || EVOLUTION_API_URL.includes('sua-instancia')) {
    console.warn('⚠️ AVISO: EVOLUTION_API_URL não configurada corretamente no .env');
}
if (!EVOLUTION_API_KEY || EVOLUTION_API_KEY.includes('sua-api-key')) {
    console.warn('⚠️ AVISO: EVOLUTION_API_KEY não configurada corretamente no .env');
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
        if (!company) throw new Error('Empresa não encontrada ou acesso negado.');
        if (!company.fiscal_module_enabled) throw new Error('Módulo fiscal não habilitado para esta empresa.');

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
        console.log(`🔍 Fetching QR Code for instance "${name}"...`);
        const response = await axios.get(`${EVOLUTION_API_URL}/instance/connect/${name}`, {
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
        console.log(`📡 Updating webhook for instance "${targetName}"...`);
        // O endpoint testado com sucesso é /webhook/set/:instance com payload aninhado
        const response = await axios.post(`${EVOLUTION_API_URL}/webhook/set/${targetName}`, {
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
        console.error('❌ Erro ao configurar webhook:', errorDetail);
        res.status(500).json({
            error: 'Erro ao configurar webhook na Evolution API',
            detail: errorDetail
        });
    }
});

app.post('/instances/:name/rename', authenticate, async (req, res) => {
    const { name } = req.params;
    const { newName } = req.body;
    const { token } = req.query;

    try {
        const targetName = await resolveTargetName(name, token as string);
        console.log(`📝 Renaming instance "${targetName}" to "${newName}"...`);

        const response = await axios.post(`${EVOLUTION_API_URL}/instance/updateInstanceName/${targetName}`, {
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
        console.log(`👤 Updating WhatsApp profile name for "${targetName}" to "${profileName}"...`);

        const response = await axios.post(`${EVOLUTION_API_URL}/chat/updateProfileName/${targetName}`, {
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
            console.log(`📡 Trying DELETE /instance/logout/${targetName}...`);
            await axios.delete(`${EVOLUTION_API_URL}/instance/logout/${targetName}`, {
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
                console.log(`📡 Trying POST /instance/logout/${targetName}...`);
                await axios.post(`${EVOLUTION_API_URL}/instance/logout/${targetName}`, {}, {
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
        console.log(`🗑️ Deleting instance "${targetName}"...`);

        const response = await axios.delete(`${EVOLUTION_API_URL}/instance/delete/${targetName}`, {
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

// --- ENDPOINTS FISCAIS (TecnoSpeed PlugNotas) ---

app.post('/fiscal/emitir', authenticate, async (req, res) => {
    const { companyId, payload, type } = req.body;
    const authHeader = req.headers.authorization;

    if (!companyId || !payload) {
        return res.status(400).json({ error: 'companyId e payload são obrigatórios' });
    }

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId);
        const apiKey = config.tecnospeed_api_key;
        // Determinar endpoint baseado no tipo (padrão nfe)
        const endpoint = type === 'nfse' ? 'nfse' : 'nfe';

        console.log(`🧾 Emitindo ${endpoint.toUpperCase()} via PlugNotas para empresa ${companyId}...`);

        const response = await axios.post(`https://api.plugnotas.com.br/${endpoint}`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            }
        });

        res.json(response.data);
    } catch (error: any) {
        const errorDetail = error.response?.data || error.message;
        console.error('❌ Erro na emissão fiscal:', JSON.stringify(errorDetail, null, 2));
        res.status(500).json({ error: 'Erro na comunicação com TecnoSpeed', detail: errorDetail });
    }
});

app.get('/fiscal/status/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const apiKey = config.tecnospeed_api_key;

        const response = await axios.get(`https://api.plugnotas.com.br/nfe/${id}`, {
            headers: { 'x-api-key': apiKey }
        });

        res.json(response.data);
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao consultar status', detail: error.response?.data || error.message });
    }
});

app.get('/fiscal/nfe/:id/pdf', authenticate, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const apiKey = config.tecnospeed_api_key;

        const response = await axios.get(`https://api.plugnotas.com.br/nfe/${id}/pdf`, {
            headers: { 'x-api-key': apiKey },
            responseType: 'arraybuffer'
        });

        res.contentType('application/pdf');
        res.send(response.data);
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao baixar PDF', detail: error.response?.data || error.message });
    }
});

app.get('/fiscal/nfe/:id/xml', authenticate, async (req, res) => {
    const { id } = req.params;
    const { companyId } = req.query;
    const authHeader = req.headers.authorization;

    try {
        const config = await getCompanyFiscalConfig(authHeader!, companyId as string);
        const apiKey = config.tecnospeed_api_key;

        const response = await axios.get(`https://api.plugnotas.com.br/nfe/${id}/xml`, {
            headers: { 'x-api-key': apiKey }
        });

        res.contentType('application/xml');
        res.send(response.data);
    } catch (error: any) {
        res.status(500).json({ error: 'Erro ao baixar XML', detail: error.response?.data || error.message });
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

        // 1. Buscar configuração da empresa no Supabase para validar e processar
        const responseSupabase = await axios.get(`${SUPABASE_URL}/rest/v1/company_payment_gateways?company_id=eq.${companyId}&provider=eq.${provider}&select=*`, {
            headers: { 'apikey': SUPABASE_ANON_KEY }
        });

        const gatewayConfig = responseSupabase.data;

        if (!gatewayConfig || !gatewayConfig[0]) {
            throw new Error('Configuração de gateway não encontrada para esta empresa');
        }

        const config = gatewayConfig[0].config;
        const is_sandbox = gatewayConfig[0].is_sandbox ?? true;
        const adapter = PaymentFactory.getAdapter(provider, config, is_sandbox);

        const { external_reference, status } = await adapter.handleNotification(notification);

        console.log(`✅ Pagamento ${external_reference} atualizado para: ${status}`);

        // 2. Atualizar o registro na tabela company_charges e buscar quote_id vinculado
        const updateChargeResponse = await axios.patch(`${SUPABASE_URL}/rest/v1/company_charges?external_reference=eq.${external_reference}&select=quote_id`, {
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

        // 3. Se houver um quote_id e o status for 'approved', atualizar o orçamento e a transação
        if (chargeData?.quote_id && status === 'approved') {
            console.log(`🔗 Sincronizando aprovação com Orçamento: ${chargeData.quote_id}`);

            // Atualizar Orçamento
            await axios.patch(`${SUPABASE_URL}/rest/v1/quotes?id=eq.${chargeData.quote_id}`, {
                payment_status: 'paid'
            }, {
                headers: { 'apikey': SUPABASE_ANON_KEY }
            });

            // Atualizar Transação associada
            await axios.patch(`${SUPABASE_URL}/rest/v1/transactions?quote_id=eq.${chargeData.quote_id}`, {
                status: 'received',
                payment_date: new Date().toISOString().split('T')[0]
            }, {
                headers: { 'apikey': SUPABASE_ANON_KEY }
            });
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

app.post('/whatsapp/send', authenticate, async (req, res) => {
    const { instanceName, number, text } = req.body;

    if (!instanceName || !number || !text) {
        return res.status(400).json({ error: 'instanceName, number e text são obrigatórios' });
    }

    try {
        console.log(`✉️ Enviando mensagem WhatsApp via "${instanceName}" para ${number}...`);

        const response = await axios.post(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
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

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

export default app;
