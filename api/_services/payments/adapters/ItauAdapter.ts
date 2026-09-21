import https from 'https';
import axios from 'axios';
import type { PaymentAdapter, ChargeRequest, PaymentResponse } from '../PaymentAdapter.js';

// Static in-memory cache for OAuth access tokens to avoid redundant mTLS network requests
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export class ItauAdapter implements PaymentAdapter {
    private clientId: string;
    private clientSecret: string;
    private agencia: string;
    private conta: string;
    private carteira: string;
    private certPem: string;
    private keyPem: string;
    private isSandbox: boolean;
    private baseUrl: string;
    private authUrl: string;
    private httpsAgent?: https.Agent;

    constructor(config: Record<string, any>, isSandbox: boolean = true) {
        this.isSandbox = isSandbox;

        // As credenciais são carregadas do banco. O frontend prefixa as chaves com sandbox_ ou prod_
        const rawClientId = isSandbox ? config.sandbox_client_id : config.prod_client_id;
        const rawClientSecret = isSandbox ? config.sandbox_client_secret : config.prod_client_secret;

        this.clientId = (rawClientId || '').trim();
        this.clientSecret = (rawClientSecret || '').trim();
        this.agencia = (isSandbox ? (config.sandbox_agencia || config.agencia) : (config.prod_agencia || config.agencia) || '').trim();
        this.conta = (isSandbox ? (config.sandbox_conta || config.conta) : (config.prod_conta || config.conta) || '').trim();
        this.carteira = (isSandbox ? (config.sandbox_carteira || config.carteira) : (config.prod_carteira || config.carteira) || '109').trim();

        this.certPem = isSandbox ? config.sandbox_certificate_pem : config.prod_certificate_pem;
        this.keyPem = isSandbox ? config.sandbox_private_key_pem : config.prod_private_key_pem;

        this.baseUrl = isSandbox
            ? 'https://sandbox.devportal.itau.com.br/cash_management/v2'
            : 'https://api.itau.com.br/cash_management/v2';

        this.authUrl = isSandbox
            ? 'https://sandbox.devportal.itau.com.br/api/oauth/token'
            : 'https://sts.itau.com.br/api/oauth/token';

        if (!this.clientId || !this.clientSecret) {
            throw new Error(`Credenciais do Banco Itaú (${isSandbox ? 'Sandbox' : 'Produção'}) incompletas. Preencha Client ID e Client Secret.`);
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

        if (this.certPem && this.keyPem) {
            let cleanCert = normalizePem(this.certPem);
            let cleanKey = normalizePem(this.keyPem);

            if (cleanCert.includes('PRIVATE KEY') && (cleanKey.includes('CERTIFICATE') || !cleanKey.includes('PRIVATE KEY'))) {
                console.log('⚠️ Detectada inversão entre Certificado e Chave Privada no Banco Itaú. Corrigindo automaticamente...');
                const temp = cleanCert;
                cleanCert = cleanKey;
                cleanKey = temp;
            }

            this.httpsAgent = new https.Agent({
                cert: cleanCert,
                key: cleanKey,
                rejectUnauthorized: false,
                keepAlive: true,
                maxSockets: 25,
                timeout: 10000
            });
        }
    }

    private async getAccessToken(): Promise<string> {
        const cacheKey = `${this.clientId}_${this.isSandbox ? 'sandbox' : 'prod'}`;
        const cached = tokenCache.get(cacheKey);

        if (cached && cached.expiresAt > Date.now() + 60000) {
            return cached.token;
        }

        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.clientId);
        params.append('client_secret', this.clientSecret);

        const candidateUrls = this.isSandbox
            ? [
                'https://sandbox.devportal.itau.com.br/api/oauth/token',
                'https://sts.itau.com.br/api/oauth/token',
                'https://api.itau.com.br/api/oauth/token'
            ]
            : [
                'https://sts.itau.com.br/api/oauth/token',
                'https://api.itau.com.br/api/oauth/token'
            ];

        let lastErrorMessage = '';

        for (const url of candidateUrls) {
            try {
                const reqConfig: any = {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 10000
                };
                if (this.httpsAgent) reqConfig.httpsAgent = this.httpsAgent;

                const response = await axios.post(url, params.toString(), reqConfig);
                if (response.data?.access_token) {
                    const token = response.data.access_token;
                    const expiresIn = (response.data.expires_in || 3600) * 1000;
                    tokenCache.set(cacheKey, { token, expiresAt: Date.now() + expiresIn });
                    return token;
                }
            } catch (err: any) {
                if (err.code !== 'ENOTFOUND' && err.response?.status !== 405) {
                    lastErrorMessage = err.response?.data?.message || err.response?.data?.error_description || err.message || '';
                }
            }
        }

        throw new Error(`Erro de Autenticação no Banco Itaú (OAuth/mTLS): ${lastErrorMessage || 'Verifique Client ID, Client Secret e Certificado mTLS.'}`);
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.getAccessToken();
            return {
                success: true,
                message: `Conexão com o Banco Itaú (${this.isSandbox ? 'Sandbox/Teste' : 'Produção'}) validada com sucesso!`
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Falha ao autenticar com o Banco Itaú.'
            };
        }
    }

    async createCharge(request: ChargeRequest): Promise<PaymentResponse> {
        try {
            const token = await this.getAccessToken();
            const taxId = (request.customer?.tax_id || '').replace(/\D/g, '');
            let cleanTaxId = taxId;
            if (cleanTaxId.length !== 11 && cleanTaxId.length !== 14) {
                if (this.isSandbox) {
                    cleanTaxId = '00000000000191';
                } else {
                    throw new Error('CPF/CNPJ do cliente precisa ter 11 (CPF) ou 14 dígitos (CNPJ).');
                }
            }

            const tipoPessoa = cleanTaxId.length === 11 ? 'F' : 'J';
            const dueDate = (request as any).due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const externalRef = request.external_reference || `ITAU-${Date.now()}`;

            const amountFormatted = request.amount.toFixed(2);

            const payload: any = {
                etapa_processamento_boleto: 'efetivacao',
                beneficiario: {
                    id_beneficiario: `${(this.agencia || '0000').padStart(4, '0')}${(this.conta || '00000').replace(/\D/g, '').padStart(7, '0')}`
                },
                dado_boleto: {
                    descricao_instrumento_cobranca: 'boleto',
                    forma_envio_boleto: 'impressao',
                    tipo_boleto: 'a_vista',
                    codigo_carteira: this.carteira || '109',
                    valor_total_titulo: amountFormatted,
                    codigo_especie: '01',
                    data_emissao: new Date().toISOString().split('T')[0],
                    dados_titulo: {
                        data_vencimento: dueDate,
                        valor_titulo: amountFormatted
                    },
                    pagador: {
                        pessoa: {
                            nome_pessoa: (request.customer?.name || 'Cliente').substring(0, 50),
                            tipo_pessoa: {
                                codigo_tipo_pessoa: tipoPessoa,
                                numero_cadastro_pessoa_fisica_ou_juridica: cleanTaxId
                            }
                        },
                        endereco: {
                            nome_logradouro: (request.customer?.address?.street || 'Rua Principal').substring(0, 40),
                            nome_bairro: (request.customer?.address?.neighborhood || 'Centro').substring(0, 30),
                            nome_cidade: (request.customer?.address?.city || 'Natal').substring(0, 30),
                            sigla_UF: (request.customer?.address?.state || 'RN').substring(0, 2),
                            numero_CEP: (request.customer?.address?.zip_code || '59000000').replace(/\D/g, '').padStart(8, '0')
                        }
                    }
                }
            };

            const reqConfig: any = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'x-itau-apikey': this.clientId
                }
            };
            if (this.httpsAgent) reqConfig.httpsAgent = this.httpsAgent;

            const response = await axios.post(`${this.baseUrl}/boletos`, payload, reqConfig);

            const resData = response.data || {};
            const dadoBoleto = resData.dado_boleto || resData;
            const paymentId = dadoBoleto.id_boleto || dadoBoleto.nosso_numero || externalRef;
            const bankSlipCode = dadoBoleto.dados_titulo?.codigo_barras || dadoBoleto.linha_digitavel || '';
            const qrCode = dadoBoleto.dados_titulo?.pix?.qr_code || dadoBoleto.pix?.emv || '';
            const paymentLink = dadoBoleto.url_pdf || resData.url_pdf || '';

            return {
                success: true,
                payment_id: String(paymentId),
                bank_slip_code: bankSlipCode,
                qr_code: qrCode,
                payment_link: paymentLink,
                due_date: dueDate,
                status: 'pending'
            };
        } catch (error: any) {
            console.error('Banco Itaú Create Charge Error:', error.response?.data || error.message);
            const detail = error.response?.data?.mensagem || error.response?.data?.detail || error.message || 'Erro ao emitir boleto no Banco Itaú.';
            return {
                success: false,
                status: 'rejected',
                error: detail
            };
        }
    }

    async getBoletoPdf(nossoNumero: string): Promise<Buffer> {
        const token = await this.getAccessToken();
        const reqConfig: any = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-itau-apikey': this.clientId
            },
            responseType: 'arraybuffer'
        };
        if (this.httpsAgent) reqConfig.httpsAgent = this.httpsAgent;

        const response = await axios.get(`${this.baseUrl}/boletos/${nossoNumero}/pdf`, reqConfig);
        return Buffer.from(response.data);
    }

    async getPaymentStatus(payment_id: string): Promise<PaymentResponse> {
        try {
            const token = await this.getAccessToken();
            const reqConfig: any = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'x-itau-apikey': this.clientId
                }
            };
            if (this.httpsAgent) reqConfig.httpsAgent = this.httpsAgent;

            const response = await axios.get(`${this.baseUrl}/boletos/${payment_id}`, reqConfig);
            const data = response.data || {};
            const situacao = (data.dado_boleto?.situacao || data.situacao || '').toUpperCase();
            const isPaid = ['PAGO', 'LIQUIDADO', 'BAIXADO_PAGO'].includes(situacao);
            const isCancelled = ['CANCELADO', 'BAIXADO', 'BAIXADO_SOLICITACAO'].includes(situacao);

            return {
                success: true,
                payment_id: String(payment_id),
                status: isPaid ? 'approved' : (isCancelled ? 'cancelled' : 'pending'),
                paid_amount: data.valor_pago || data.dado_boleto?.valor_pago,
                paid_at: data.data_pagamento
            };
        } catch (error: any) {
            console.error('Banco Itaú Get Payment Status Error:', error.message);
            return {
                success: false,
                status: 'pending',
                error: error.message
            };
        }
    }

    async handleNotification(payload: any): Promise<{ external_reference: string; status: string; paid_amount?: number; fee?: number; receipt_url?: string }> {
        const external_reference = payload.id_boleto || payload.nosso_numero || payload.seu_numero || '';
        const rawStatus = (payload.situacao || payload.status || '').toUpperCase();

        let status = 'pending';
        if (['PAGO', 'LIQUIDADO', 'BAIXADO_PAGO'].includes(rawStatus)) {
            status = 'approved';
        } else if (['CANCELADO', 'BAIXADO', 'EXPIRADO'].includes(rawStatus)) {
            status = 'cancelled';
        }

        return {
            external_reference,
            status,
            paid_amount: payload.valor_pago || payload.valor_titulo,
            fee: payload.valor_tarifa || 0
        };
    }
}
