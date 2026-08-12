import https from 'https';
import axios from 'axios';
import type { PaymentAdapter, ChargeRequest, PaymentResponse } from '../PaymentAdapter.js';

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

        // Configura o agente HTTPS para mTLS (Autenticação mútua via certificado digital)
        this.httpsAgent = new https.Agent({
            cert: cleanCert,
            key: cleanKey,
            rejectUnauthorized: !isSandbox // Sandbox pode usar certificados autoassinados/teste
        });
    }

    private async getAccessToken(): Promise<string> {
        try {
            const params = new URLSearchParams();
            params.append('client_id', this.clientId);
            params.append('client_secret', this.clientSecret);
            params.append('grant_type', 'client_credentials');
            params.append('scope', 'boleto-cobranca.read boleto-cobranca.write');

            const tokenUrl = `${this.baseUrl}/oauth/v2/token`;
            const response = await axios.post(tokenUrl, params.toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                httpsAgent: this.httpsAgent
            });

            if (!response.data?.access_token) {
                throw new Error('Retorno da API do Banco Inter não contém access_token.');
            }

            return response.data.access_token;
        } catch (error: any) {
            console.error('Banco Inter OAuth Error:', error.response?.data || error.message);
            const detail = error.response?.data?.error_description || error.message;
            throw new Error(`Erro de Autenticação no Banco Inter (mTLS): ${detail}`);
        }
    }

    async createCharge(request: ChargeRequest): Promise<PaymentResponse> {
        try {
            const token = await this.getAccessToken();
            const taxId = (request.customer?.tax_id || '').replace(/\D/g, '');
            // Garante que o CPF/CNPJ tenha 11 (CPF) ou 14 (CNPJ) dígitos. Se estiver incompleto em Sandbox, usa padrão válido
            let cleanTaxId = taxId;
            if (cleanTaxId.length !== 11 && cleanTaxId.length !== 14) {
                if (this.isSandbox) {
                    cleanTaxId = '00000000000191'; // CNPJ padrão para testes no Sandbox
                } else {
                    throw new Error('CPF/CNPJ do cliente precisa ter 11 (CPF) ou 14 dígitos (CNPJ).');
                }
            }

            const tipoPessoa = cleanTaxId.length === 11 ? 'FISICA' : 'JURIDICA';
            
            // O vencimento é padrão de 24h após a emissão
            const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Extrai o companyId da url de notificação para compor o proxy de PDF
            let companyId = '';
            if (request.notification_url) {
                const parts = request.notification_url.split('/');
                companyId = parts[parts.length - 1] || '';
            }

            // Identificador próprio do título (seuNumero) - Máximo 15 caracteres alfanuméricos
            const seuNumero = (request.external_reference || `CHG${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);

            const payload = {
                seuNumero: seuNumero || '12345',
                valorNominal: request.amount,
                dataVencimento: dueDate,
                numDiasAgendaRecebimento: 30, // Mantém ativo por 30 dias para pagamentos em atraso
                pagador: {
                    cpfCnpj: cleanTaxId,
                    tipoPessoa: tipoPessoa,
                    nome: request.customer.name.substring(0, 100),
                    endereco: request.customer.address?.street?.substring(0, 90) || 'Rua Principal',
                    numero: request.customer.address?.number?.substring(0, 10) || '100',
                    bairro: request.customer.address?.neighborhood?.substring(0, 60) || 'Centro',
                    cidade: request.customer.address?.city?.substring(0, 60) || 'Cidade',
                    uf: request.customer.address?.state?.substring(0, 2) || 'SP',
                    cep: (request.customer.address?.zip_code || '').replace(/\D/g, '').substring(0, 8) || '01001000'
                },
                mensagem: {
                    linha1: (request.description || 'Cobranca').substring(0, 78)
                }
            };

            const response = await axios.post(`${this.baseUrl}/cobranca/v3/cobrancas`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                httpsAgent: this.httpsAgent
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
                httpsAgent: this.httpsAgent
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

    async getBoletoPdf(nossoNumero: string): Promise<Buffer> {
        const token = await this.getAccessToken();
        const response = await axios.get(`${this.baseUrl}/cobranca/v3/cobrancas/${nossoNumero}/pdf`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            httpsAgent: this.httpsAgent,
            responseType: 'arraybuffer'
        });

        if (!response.data) {
            throw new Error('PDF vazio ou inválido retornado pelo Banco Inter.');
        }

        return Buffer.from(response.data);
    }

    async handleNotification(payload: any): Promise<{ external_reference: string; status: string }> {
        // O Webhook do Banco Inter pode vir como array ou objeto único
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
