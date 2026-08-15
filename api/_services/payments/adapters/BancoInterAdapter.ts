import https from 'https';
import axios from 'axios';
import type { PaymentAdapter, ChargeRequest, PaymentResponse } from '../PaymentAdapter.js';

// Static in-memory cache for OAuth access tokens to avoid redundant mTLS network requests
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export class BancoInterAdapter implements PaymentAdapter {
    private clientId: string;
    private clientSecret: string;
    private certPem: string;
    private keyPem: string;
    private isSandbox: boolean;
    private baseUrl: string;
    private httpsAgent: https.Agent;

    constructor(config: Record<string, any>, isSandbox: boolean = true) {
        this.isSandbox = isSandbox;
        
        // As credenciais são carregadas do banco. O frontend prefixa as chaves com sandbox_ ou prod_
        const rawClientId = isSandbox ? config.sandbox_client_id : config.prod_client_id;
        const rawClientSecret = isSandbox ? config.sandbox_client_secret : config.prod_client_secret;

        this.clientId = (rawClientId || '').trim().toLowerCase();
        this.clientSecret = (rawClientSecret || '').trim();
        this.certPem = isSandbox ? config.sandbox_certificate_pem : config.prod_certificate_pem;
        this.keyPem = isSandbox ? config.sandbox_private_key_pem : config.prod_private_key_pem;

        this.baseUrl = isSandbox 
            ? 'https://cdpj-sandbox.partners.uatinter.co' 
            : 'https://cdpj.partners.bancointer.com.br';

        if (!this.clientId || !this.clientSecret || !this.certPem || !this.keyPem) {
            throw new Error(`Credenciais do Banco Inter (${isSandbox ? 'Sandbox' : 'Produção'}) incompletas ou ausentes.`);
        }

        // Sanitiza e normaliza quebras de linha no formato PEM
        const normalizePem = (pem: string): string => {
            if (!pem) return '';
            let formatted = pem.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
            if (!formatted.includes('\n')) {
                formatted = formatted
                    .replace(/(-----BEGIN [A-Z ]+-----)/, '$1\n')
                    .replace(/(-----END [A-Z ]+-----)/, '\n$1');
            }
            return formatted;
        };

        let cleanCert = normalizePem(this.certPem);
        let cleanKey = normalizePem(this.keyPem);

        // Se o usuário por engano colou a Chave Privada no campo do Certificado e vice-versa, corrige automaticamente
        if (cleanCert.includes('PRIVATE KEY') && (cleanKey.includes('CERTIFICATE') || !cleanKey.includes('PRIVATE KEY'))) {
            console.log('⚠️ Detectada inversão entre Certificado e Chave Privada no Banco Inter. Corrigindo automaticamente...');
            const temp = cleanCert;
            cleanCert = cleanKey;
            cleanKey = temp;
        }

        // Configura o agente HTTPS para mTLS com Keep-Alive para máxima performance
        this.httpsAgent = new https.Agent({
            cert: cleanCert,
            key: cleanKey,
            rejectUnauthorized: false, // Previne timeouts de Handshake TLS no ambiente serverless
            keepAlive: true,
            maxSockets: 25,
            timeout: 10000
        });
    }

    private async getAccessToken(): Promise<string> {
        const cacheKey = `${this.clientId}_${this.isSandbox ? 'sandbox' : 'prod'}`;
        const cached = tokenCache.get(cacheKey);

        if (cached && cached.expiresAt > Date.now() + 60000) {
            return cached.token;
        }

        const params = new URLSearchParams();
        params.append('client_id', this.clientId);
        params.append('client_secret', this.clientSecret);
        params.append('grant_type', 'client_credentials');
        params.append('scope', 'boleto-cobranca.read boleto-cobranca.write');

        const tokenUrl = `${this.baseUrl}/oauth/v2/token`;

        const attemptFetch = async (timeoutMs: number) => {
            const response = await axios.post(tokenUrl, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                httpsAgent: this.httpsAgent,
                timeout: timeoutMs
            });

            if (!response.data?.access_token) {
                throw new Error('Retorno da API do Banco Inter não contém access_token.');
            }

            const token = response.data.access_token;
            const expiresIn = (response.data.expires_in || 3600) * 1000;
            tokenCache.set(cacheKey, { token, expiresAt: Date.now() + expiresIn });
            return token;
        };

        try {
            return await attemptFetch(15000);
        } catch (firstErr: any) {
            console.warn('⚠️ Primeira tentativa de token mTLS no Banco Inter falhou. Tentando novamente...', firstErr.message);
            try {
                return await attemptFetch(15000);
            } catch (retryErr: any) {
                console.error('Banco Inter OAuth Error:', retryErr.response?.data || retryErr.message);
                const detail = retryErr.response?.data?.error_description || retryErr.message || '';
                if (detail.includes('timeout') || retryErr.code === 'ECONNABORTED' || retryErr.message?.includes('timeout')) {
                    const envName = this.isSandbox ? 'Sandbox (uatinter.co)' : 'Produção (bancointer.com.br)';
                    throw new Error(`O ambiente de ${envName} do Banco Inter demorou para responder. Os servidores de Sandbox passam por manutenção noturna fora do horário comercial. Altere para Produção nas configurações para emitir boletos 24h.`);
                }
                throw new Error(`Erro de Autenticação no Banco Inter (mTLS): ${detail}`);
            }
        }
    }

    async createCharge(request: ChargeRequest): Promise<PaymentResponse> {
        try {
            const token = await this.getAccessToken();
            const taxId = (request.customer?.tax_id || '').replace(/\D/g, '');
            let cleanTaxId = taxId;
            if (cleanTaxId.length !== 11 && cleanTaxId.length !== 14) {
                if (this.isSandbox) {
                    cleanTaxId = '00000000000191'; // CNPJ padrão para testes no Sandbox
                } else {
                    throw new Error('CPF/CNPJ do cliente precisa ter 11 (CPF) ou 14 dígitos (CNPJ).');
                }
            }

            const tipoPessoa = cleanTaxId.length === 11 ? 'FISICA' : 'JURIDICA';
            
            // O vencimento utiliza o due_date informado ou padrão de 24h
            const dueDate = (request as any).due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Extrai o companyId da url de notificação para compor o proxy de PDF
            let companyId = '';
            if (request.notification_url) {
                const parts = request.notification_url.split('/');
                companyId = parts[parts.length - 1] || '';
            }

            // Identificador próprio do título (seuNumero) - Máximo 15 caracteres alfanuméricos (ex: NF63)
            const seuNumero = (request.external_reference || `NF${request.description?.replace(/\D/g, '') || Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);

            const payload: any = {
                seuNumero: seuNumero || '12345',
                valorNominal: request.amount,
                dataVencimento: dueDate,
                numDiasAgendaRecebimento: 30,
                pagador: {
                    cpfCnpj: cleanTaxId,
                    tipoPessoa: tipoPessoa,
                    nome: (request.customer?.name || 'Cliente').substring(0, 100),
                    endereco: 'Rua Principal',
                    cidade: 'Natal',
                    uf: 'RN',
                    cep: '59000000'
                }
            };

            if (request.fine && request.fine.value > 0) {
                payload.multa = {
                    codigoMulta: request.fine.type === 'FIXED' ? 'VALORFIXO' : 'PERCENTUAL',
                    valor: request.fine.type === 'FIXED' ? request.fine.value : 0,
                    taxa: request.fine.type === 'PERCENTAGE' ? request.fine.value : 0
                };
            }
            if (request.interest && request.interest.value > 0) {
                payload.mora = {
                    codigoMora: 'TAXAMENSAL',
                    taxa: request.interest.value
                };
            }
            if (request.discount && request.discount.value > 0) {
                payload.desconto1 = {
                    codigoDesconto: request.discount.type === 'FIXED' ? 'VALORFIXO' : 'PERCENTUAL',
                    valor: request.discount.type === 'FIXED' ? request.discount.value : 0,
                    taxa: request.discount.type === 'PERCENTAGE' ? request.discount.value : 0
                };
            }
            if (request.instructions) {
                payload.mensagem = {
                    linha1: request.instructions.slice(0, 78),
                    linha2: request.instructions.slice(78, 156),
                    linha3: request.instructions.slice(156, 234)
                };
            }

            const response = await axios.post(`${this.baseUrl}/cobranca/v3/cobrancas`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.httpsAgent,
                timeout: 10000
            });

            const data = response.data;
            const nossoNumero = data?.nossoNumero || data?.codigoSolicitacao || data?.seuNumero;
            if (!nossoNumero) {
                throw new Error('Banco Inter não retornou a identificação da cobrança.');
            }

            // Gera o link de proxy interno da API local para download de PDF, já que o PDF exige mTLS
            const host = (request.notification_url ? request.notification_url.split('/payments/webhook/')[0] : '');
            const pdfProxyUrl = `${host}/api/payments/inter/pdf/${companyId}/${nossoNumero}${this.isSandbox ? '?sandbox=true' : ''}`;

            return {
                success: true,
                payment_id: nossoNumero,
                qr_code: data.pix?.pixCopiaeCola || data.pixCopiaeCola || '',
                qr_code_base64: data.pix?.imagemQrCode || data.imagemQrCode || '',
                payment_link: pdfProxyUrl,
                status: 'pending'
            };

        } catch (error: any) {
            console.error('Banco Inter Charge Error:', error.response?.data || error.message);
            const errData = error.response?.data;
            let detail = '';
            if (errData?.violacoes && Array.isArray(errData.violacoes)) {
                detail = errData.violacoes.map((v: any) => `${v.propriedade || ''}: ${v.razao || v.valor || ''}`).join('; ');
            } else if (errData && typeof errData === 'object') {
                detail = errData.detail || errData.message || errData.title || JSON.stringify(errData);
            } else {
                detail = errData || error.message;
            }
            return {
                success: false,
                status: 'rejected',
                error: `Erro ao emitir boleto no Banco Inter: ${detail}`
            };
        }
    }

    async getPaymentStatus(payment_id: string): Promise<PaymentResponse> {
        try {
            const token = await this.getAccessToken();
            const response = await axios.get(`${this.baseUrl}/cobranca/v3/cobrancas/${payment_id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                httpsAgent: this.httpsAgent,
                timeout: 8000
            });

            const data = response.data;
            return {
                success: true,
                payment_id: payment_id,
                status: this.mapStatus(data.situacao)
            };
        } catch (error: any) {
            console.error('Banco Inter status check error:', error.response?.data || error.message);
            throw error;
        }
    }

    async checkStatus(payment_id: string): Promise<{ success: boolean; payment_id: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled' }> {
        try {
            const token = await this.getAccessToken();
            const response = await axios.get(`${this.baseUrl}/cobranca/v3/cobrancas/${payment_id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                httpsAgent: this.httpsAgent,
                timeout: 8000
            });

            const data = response.data;
            return {
                success: true,
                payment_id: payment_id,
                status: this.mapStatus(data.situacao)
            };
        } catch (error: any) {
            console.error('Banco Inter status check error:', error.response?.data || error.message);
            throw error;
        }
    }

    async cancelCharge(codigoSolicitacao: string, motivo: string = 'APEDIDODOCLIENTE'): Promise<{ success: boolean; message: string }> {
        try {
            const token = await this.getAccessToken();
            await axios.post(`${this.baseUrl}/cobranca/v3/cobrancas/${codigoSolicitacao}/cancelar`, {
                motivoCancelamento: motivo
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                httpsAgent: this.httpsAgent,
                timeout: 8000
            });

            return {
                success: true,
                message: 'Boleto cancelado no Banco Inter com sucesso!'
            };
        } catch (error: any) {
            console.error('Banco Inter cancel charge error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.mensagem || error.response?.data?.detail || error.message || 'Erro ao cancelar boleto no Banco Inter.');
        }
    }

    async getBoletoPdf(nossoNumero: string): Promise<Buffer> {
        const token = await this.getAccessToken();
        const response = await axios.get(`${this.baseUrl}/cobranca/v3/cobrancas/${nossoNumero}/pdf`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            httpsAgent: this.httpsAgent,
            timeout: 10000
        });

        const rawData = response.data;
        const pdfBase64 = typeof rawData === 'object' ? rawData?.pdf : rawData;

        if (!pdfBase64) {
            throw new Error('PDF vazio ou inválido retornado pelo Banco Inter.');
        }

        if (typeof pdfBase64 === 'string') {
            const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '').trim();
            return Buffer.from(cleanBase64, 'base64');
        }

        return Buffer.from(pdfBase64);
    }

    async handleNotification(payload: any): Promise<{ external_reference: string; status: string }> {
        const item = Array.isArray(payload) ? payload[0] : payload;
        const nossoNumero = item?.nossoNumero || item?.pix?.[0]?.txid || '';
        
        if (!nossoNumero) {
            throw new Error('Payload do Webhook do Banco Inter inválido.');
        }

        const situacao = item?.situacao || 'PAGO';

        return {
            external_reference: nossoNumero,
            status: this.mapStatus(situacao)
        };
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.getAccessToken();
            return { success: true, message: 'Autenticação mTLS realizada com sucesso!' };
        } catch (error: any) {
            console.error('Banco Inter Connection Test Error:', error.message);
            return { success: false, message: error.message };
        }
    }

    private mapStatus(interStatus: string): 'pending' | 'approved' | 'rejected' | 'cancelled' {
        switch (interStatus) {
            case 'PAGO': return 'approved';
            case 'EMABERTO': return 'pending';
            case 'CANCELADO':
            case 'EXPIRADO': return 'cancelled';
            default: return 'pending';
        }
    }
}
