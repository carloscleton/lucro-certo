import https from 'https';
import axios from 'axios';
import type { PaymentAdapter, ChargeRequest, PaymentResponse } from '../PaymentAdapter.js';

// Static in-memory cache for OAuth access tokens to avoid redundant network requests
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export class C6BankAdapter implements PaymentAdapter {
    private clientId: string;
    private clientSecret: string;
    private certPem: string;
    private keyPem: string;
    private isSandbox: boolean;
    private baseUrl: string;
    private httpsAgent?: https.Agent;

    constructor(config: Record<string, any>, isSandbox: boolean = true) {
        this.isSandbox = isSandbox;
        
        // As credenciais são carregadas do banco. O frontend prefixa as chaves com sandbox_ ou prod_
        const rawClientId = isSandbox ? config.sandbox_client_id : config.prod_client_id;
        const rawClientSecret = isSandbox ? config.sandbox_client_secret : config.prod_client_secret;

        this.clientId = (rawClientId || '').trim();
        this.clientSecret = (rawClientSecret || '').trim();
        this.certPem = isSandbox ? config.sandbox_certificate_pem : config.prod_certificate_pem;
        this.keyPem = isSandbox ? config.sandbox_private_key_pem : config.prod_private_key_pem;

        this.baseUrl = isSandbox 
            ? 'https://baas-api-sandbox.c6bank.info' 
            : 'https://baas-api.c6bank.info';

        if (!this.clientId || !this.clientSecret) {
            throw new Error(`Credenciais do C6 Bank (${isSandbox ? 'Sandbox' : 'Produção'}) incompletas ou ausentes. Preencha Client ID e Client Secret.`);
        }

        // Sanitiza e normaliza quebras de linha no formato PEM se certificado/chave foram informados
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
                console.log('⚠️ Detectada inversão entre Certificado e Chave Privada no C6 Bank. Corrigindo automaticamente...');
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
        params.append('client_id', this.clientId);
        params.append('client_secret', this.clientSecret);
        params.append('grant_type', 'client_credentials');
        params.append('scope', 'bankslip.read bankslip.write bankslip_pix.read bankslip_pix.write');

        const candidateUrls = this.isSandbox
            ? [
                'https://baas-api-sandbox.c6bank.info/auth',
                'https://baas-api-sandbox.c6bank.info/v1/auth',
                'https://baas-api-sandbox.c6bank.info/oauth/token',
                'https://baas-api.c6bank.info/auth'
            ]
            : [
                'https://baas-api.c6bank.info/auth',
                'https://baas-api.c6bank.info/v1/auth',
                'https://baas-api.c6bank.info/oauth/token'
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
                    const expiresIn = (response.data.expires_in || 300) * 1000;
                    tokenCache.set(cacheKey, { token, expiresAt: Date.now() + expiresIn });
                    this.baseUrl = url.substring(0, url.lastIndexOf('/auth'));
                    return token;
                }
            } catch (err: any) {
                if (err.code !== 'ENOTFOUND' && err.response?.status !== 405) {
                    lastErrorMessage = err.response?.data?.message || err.response?.data?.error_description || err.message || '';
                }
                
                // If 405 Method Not Allowed, try JSON format on same URL
                if (err.response?.status === 405) {
                    try {
                        const reqConfigJson: any = {
                            headers: { 'Content-Type': 'application/json' },
                            timeout: 10000
                        };
                        if (this.httpsAgent) reqConfigJson.httpsAgent = this.httpsAgent;

                        const responseJson = await axios.post(url, {
                            client_id: this.clientId,
                            client_secret: this.clientSecret,
                            grant_type: 'client_credentials'
                        }, reqConfigJson);

                        if (responseJson.data?.access_token) {
                            const token = responseJson.data.access_token;
                            const expiresIn = (responseJson.data.expires_in || 300) * 1000;
                            tokenCache.set(cacheKey, { token, expiresAt: Date.now() + expiresIn });
                            this.baseUrl = url.substring(0, url.lastIndexOf('/auth'));
                            return token;
                        }
                    } catch (jsonErr: any) {
                        if (jsonErr.code !== 'ENOTFOUND' && jsonErr.response?.status !== 405) {
                            lastErrorMessage = jsonErr.response?.data?.message || jsonErr.message || lastErrorMessage;
                        }
                    }
                }
            }
        }

        throw new Error(`Erro de Autenticação no C6 Bank: ${lastErrorMessage || 'Verifique Client ID, Client Secret e Certificado mTLS.'}`);
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            await this.getAccessToken();
            return {
                success: true,
                message: `Conexão com C6 Bank (${this.isSandbox ? 'Sandbox/Teste' : 'Produção'}) realizada com sucesso!`
            };
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Falha ao autenticar com o C6 Bank.'
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

            const dueDate = (request as any).due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const externalRef = request.external_reference || `C6-${Date.now()}`;

            const payload: any = {
                external_reference_id: externalRef,
                amount: request.amount,
                due_date: dueDate,
                description: request.description || 'Cobrança BolePix C6 Bank',
                payer: {
                    name: (request.customer?.name || 'Cliente').substring(0, 100),
                    document: cleanTaxId,
                    address: {
                        street: request.customer?.address?.street || 'Rua Principal',
                        number: request.customer?.address?.number || '100',
                        neighborhood: request.customer?.address?.neighborhood || 'Centro',
                        city: request.customer?.address?.city || 'Natal',
                        state: request.customer?.address?.state || 'RN',
                        zip_code: (request.customer?.address?.zip_code || '59000000').replace(/\D/g, '')
                    }
                }
            };

            if (request.fine && request.fine.value > 0) {
                payload.fine = {
                    value: request.fine.value,
                    type: request.fine.type || 'PERCENTAGE'
                };
            }
            if (request.interest && request.interest.value > 0) {
                payload.interest = {
                    value: request.interest.value
                };
            }
            if (request.discount && request.discount.value > 0) {
                payload.discount = {
                    value: request.discount.value,
                    due_date_limit_days: request.discount.dueDateLimitDays || 0
                };
            }
            if (request.instructions) {
                payload.instructions = request.instructions;
            }

            const reqConfig: any = {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            };
            if (this.httpsAgent) reqConfig.httpsAgent = this.httpsAgent;

            const response = await axios.post(`${this.baseUrl}/v1/bank_slips/`, payload, reqConfig);

            const resData = response.data || {};
            const paymentId = resData.id || resData.bank_slip_id || externalRef;
            const bankSlipCode = resData.digitable_line || resData.barcode || '';
            const qrCode = resData.qr_code || resData.pix_copy_paste || '';
            const qrCodeBase64 = resData.qr_code_base64 || resData.qr_code_image || '';
            const paymentLink = resData.payment_link || resData.pdf_url || '';

            return {
                success: true,
                payment_id: String(paymentId),
                bank_slip_code: bankSlipCode,
                qr_code: qrCode,
                qr_code_base64: qrCodeBase64,
                payment_link: paymentLink,
                due_date: dueDate,
                status: 'pending'
            };
        } catch (error: any) {
            console.error('C6 Bank Create Charge Error:', error.response?.data || error.message);
            const detail = error.response?.data?.message || error.response?.data?.detail || error.message || 'Erro ao gerar boleto no C6 Bank.';
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
                'Authorization': `Bearer ${token}`
            },
            responseType: 'arraybuffer'
        };
        if (this.httpsAgent) reqConfig.httpsAgent = this.httpsAgent;

        const response = await axios.get(`${this.baseUrl}/pix/bank_slips/${nossoNumero}/pdf`, reqConfig);
        return Buffer.from(response.data);
    }

    async getPaymentStatus(payment_id: string): Promise<PaymentResponse> {
        try {
            const token = await this.getAccessToken();
            const reqConfig: any = {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            };
            if (this.httpsAgent) reqConfig.httpsAgent = this.httpsAgent;

            const response = await axios.get(`${this.baseUrl}/pix/bank_slips/${payment_id}`, reqConfig);
            const data = response.data || {};
            const isPaid = data.status === 'PAID' || data.status === 'SETTLED' || data.status === 'PAGO';
            const isCancelled = data.status === 'CANCELLED' || data.status === 'BAIXADO';

            return {
                success: true,
                payment_id: String(payment_id),
                status: isPaid ? 'approved' : (isCancelled ? 'cancelled' : 'pending'),
                paid_amount: data.paid_amount || data.amount,
                paid_at: data.paid_at
            };
        } catch (error: any) {
            console.error('C6 Bank Get Payment Status Error:', error.message);
            return {
                success: false,
                status: 'pending',
                error: error.message
            };
        }
    }

    async handleNotification(payload: any): Promise<{ external_reference: string; status: string; paid_amount?: number; fee?: number; receipt_url?: string }> {
        const external_reference = payload.external_reference_id || payload.external_reference || payload.id || '';
        const rawStatus = (payload.status || payload.event || '').toUpperCase();

        let status = 'pending';
        if (['PAID', 'SETTLED', 'PAYMENT_RECEIVED', 'PAGO'].includes(rawStatus)) {
            status = 'approved';
        } else if (['CANCELLED', 'EXPIRED', 'BAIXADO'].includes(rawStatus)) {
            status = 'cancelled';
        }

        return {
            external_reference,
            status,
            paid_amount: payload.paid_amount || payload.amount,
            fee: payload.fee || 0
        };
    }
}
