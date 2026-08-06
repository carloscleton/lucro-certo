import axios from 'axios';
import type { PaymentAdapter, ChargeRequest, PaymentResponse } from '../PaymentAdapter.js';

export class AsaasAdapter implements PaymentAdapter {
    private apiKey: string;
    private baseUrl: string;

    constructor(config: Record<string, any>, isSandbox: boolean = true) {
        this.apiKey = isSandbox ? config.sandbox_api_key : config.prod_api_key;
        this.baseUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';

        if (!this.apiKey) {
            throw new Error(`Asaas API Key (${isSandbox ? 'Sandbox' : 'Produção'}) não configurada.`);
        }
    }

    async createCharge(request: ChargeRequest): Promise<PaymentResponse> {
        try {
            // 1. Map billing type
            let billingType = 'PIX';
            if (request.payment_method === 'boleto') billingType = 'BOLETO';
            if (request.payment_method === 'credit_card') billingType = 'CREDIT_CARD';

            // 2. Create the payment
            const payload: any = {
                customer: await this.getOrCreateCustomer(request.customer),
                billingType,
                value: request.amount,
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 24h due date
                description: request.description,
                externalReference: request.external_reference,
            };

            const response = await axios.post(`${this.baseUrl}/payments`, payload, {
                headers: { 'access_token': this.apiKey }
            });

            const payment = response.data;

            // 3. Get PIX QR Code if it's PIX
            let qrCodeData = null;
            if (billingType === 'PIX') {
                try {
                    const qrCodeResponse = await axios.get(`${this.baseUrl}/payments/${payment.id}/pixQrCode`, {
                        headers: { 'access_token': this.apiKey }
                    });
                    qrCodeData = qrCodeResponse.data;
                } catch (qrError) {
                    console.warn('Could not get PIX QR code for Asaas payment:', payment.id);
                }
            }

            return {
                success: true,
                payment_id: payment.id,
                qr_code: qrCodeData?.payload,
                qr_code_base64: qrCodeData?.encodedImage,
                payment_link: payment.invoiceUrl,
                status: this.mapStatus(payment.status)
            };

        } catch (error: any) {
            console.error('Asaas Error:', error.response?.data || error.message);
            const detail = error.response?.data?.errors?.[0]?.description || error.message;
            return {
                success: false,
                status: 'rejected',
                error: detail
            };
        }
    }

    async getPaymentStatus(payment_id: string): Promise<PaymentResponse> {
        try {
            const response = await axios.get(`${this.baseUrl}/payments/${payment_id}`, {
                headers: { 'access_token': this.apiKey }
            });

            return {
                success: true,
                payment_id: response.data.id,
                status: this.mapStatus(response.data.status)
            };
        } catch (error: any) {
            console.error('Asaas status check error:', error.message);
            throw error;
        }
    }

    async handleNotification(payload: any): Promise<{ external_reference: string; status: string }> {
        // Asaas Webhook payload contains the payment object
        const payment = payload.payment;
        if (!payment) throw new Error('Invalid Asaas notification payload');

        return {
            external_reference: payment.externalReference,
            status: this.mapStatus(payment.status)
        };
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            // 1. Test API Key by fetching accounts
            const response = await axios.get(`${this.baseUrl}/accounts`, {
                headers: { 'access_token': this.apiKey }
            });

            if (response.status !== 200) {
                return { success: false, message: 'Falha na autenticação com Asaas.' };
            }

            // 2. Check for PIX keys (Recommended by Asaas docs)
            const keysResponse = await axios.get(`${this.baseUrl}/pix/addressKeys`, {
                headers: { 'access_token': this.apiKey }
            });

            const hasKey = keysResponse.data.data.length > 0;
            if (!hasKey) {
                return {
                    success: true,
                    message: 'Conexão OK, mas você não tem uma chave PIX no Asaas. Recomendamos criar uma chave aleatória para pagamentos mais rápidos.'
                };
            }

            return { success: true, message: 'Conexão com Asaas estabelecida e Chave PIX detectada!' };
        } catch (error: any) {
            console.error('Asaas Connection Test Error:', error.response?.data || error.message);
            const detail = error.response?.data?.errors?.[0]?.description || error.message;
            return { success: false, message: `Erro: ${detail}` };
        }
    }

    /**
     * Permite criar uma chave aleatória (EVP) conforme documentação:
     * https://docs.asaas.com/reference/criar-uma-chave
     */
    async createRandomPixKey(): Promise<{ success: boolean; message: string; key?: string }> {
        try {
            const response = await axios.post(`${this.baseUrl}/pix/addressKeys`, {
                type: 'EVP'
            }, {
                headers: { 'access_token': this.apiKey }
            });

            return {
                success: true,
                message: 'Chave Aleatória (EVP) criada com sucesso!',
                key: response.data.key
            };
        } catch (error: any) {
            console.error('Asaas Create Key Error:', error.response?.data || error.message);
            const detail = error.response?.data?.errors?.[0]?.description || error.message;
            return { success: false, message: `Erro ao criar chave: ${detail}` };
        }
    }

    private async getOrCreateCustomer(customer: any): Promise<string> {
        try {
            const taxId = (customer.tax_id || '').replace(/\D/g, '');

            if (!taxId) {
                throw new Error('CPF/CNPJ do cliente é obrigatório para cobranças via Asaas.');
            }

            // Try to find by taxId (CPF/CNPJ)
            const searchResponse = await axios.get(`${this.baseUrl}/customers?cpfCnpj=${taxId}`, {
                headers: { 'access_token': this.apiKey }
            });

            if (searchResponse.data.data.length > 0) {
                return searchResponse.data.data[0].id;
            }

            // Create new if not found
            const createResponse = await axios.post(`${this.baseUrl}/customers`, {
                name: customer.name,
                email: customer.email,
                cpfCnpj: taxId
            }, {
                headers: { 'access_token': this.apiKey }
            });

            return createResponse.data.id;
        } catch (error: any) {
            console.error('Asaas Customer Error:', error.response?.data || error.message);
            const errorMessage = error.response?.data?.errors?.[0]?.description || error.message;
            throw new Error(`Erro ao gerenciar cliente no Asaas: ${errorMessage}`);
        }
    }

    private mapStatus(asaasStatus: string): 'pending' | 'approved' | 'rejected' | 'cancelled' {
        switch (asaasStatus) {
            case 'RECEIVED':
            case 'CONFIRMED':
            case 'RECEIVED_IN_CASH': return 'approved';
            case 'PENDING': return 'pending';
            case 'OVERDUE':
            case 'REFUNDED':
            case 'REFUND_REQUESTED':
            case 'CHARGEBACK_REQUESTED':
            case 'CHARGEBACK_DISPUTE':
            case 'AWAITING_CHARGEBACK_REVERSAL': return 'cancelled';
            default: return 'pending';
        }
    }
}
