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
            let billingType = 'BOLETO';
            if (request.payment_method === 'pix') billingType = 'PIX';
            else if (request.payment_method === 'credit_card') billingType = 'CREDIT_CARD';
            else if (request.payment_method === 'boleto' || request.payment_method === 'all' || !request.payment_method) billingType = 'BOLETO';

            // 2. Create the payment
            const payload: any = {
                customer: await this.getOrCreateCustomer(request.customer),
                billingType,
                value: request.amount,
                dueDate: request.due_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                description: request.instructions ? `${request.description || ''}\n${request.instructions}` : request.description,
                externalReference: request.external_reference,
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
                    dueDateLimitDays: request.discount.dueDateLimitDays || 0,
                    type: request.discount.type || 'PERCENTAGE'
                };
            }

            const response = await axios.post(`${this.baseUrl}/payments`, payload, {
                headers: { 'access_token': this.apiKey }
            });

            const payment = response.data;

            // 3. Get PIX QR Code if it's PIX or BOLETO (Boleto Híbrido Asaas)
            let qrCodeData = null;
            if (billingType === 'PIX' || billingType === 'BOLETO') {
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
                payment_link: payment.bankSlipUrl || payment.invoiceUrl,
                due_date: payment.dueDate || request.due_date,
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

    async cancelCharge(payment_id: string): Promise<PaymentResponse> {
        try {
            const response = await axios.delete(`${this.baseUrl}/payments/${payment_id}`, {
                headers: { 'access_token': this.apiKey }
            });

            return {
                success: true,
                payment_id: response.data?.id || payment_id,
                status: 'cancelled'
            };
        } catch (error: any) {
            console.error('Asaas cancel charge error:', error.response?.data || error.message);
            const detail = error.response?.data?.errors?.[0]?.description || error.message;
            return {
                success: false,
                status: 'rejected',
                error: `Erro ao cancelar cobrança no Asaas: ${detail}`
            };
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

    async syncCustomer(customer: {
        name: string;
        email?: string;
        tax_id?: string;
        phone?: string;
        mobilePhone?: string;
        zipCode?: string;
        street?: string;
        number?: string;
        complement?: string;
        neighborhood?: string;
        city?: string;
        state?: string;
    }): Promise<{ success: boolean; customer_id?: string; message?: string }> {
        try {
            const taxId = (customer.tax_id || '').replace(/\D/g, '');
            if (!taxId) {
                return { success: false, message: 'CPF/CNPJ não informado para sincronizar no Asaas.' };
            }

            const cleanZip = (customer.zipCode || '').replace(/\D/g, '');
            const payload: any = {
                name: customer.name,
                email: customer.email || undefined,
                phone: (customer.phone || '').replace(/\D/g, '') || undefined,
                mobilePhone: (customer.mobilePhone || customer.phone || '').replace(/\D/g, '') || undefined,
                cpfCnpj: taxId,
                postalCode: cleanZip || undefined,
                address: customer.street || undefined,
                addressNumber: customer.number || undefined,
                complement: customer.complement || undefined,
                province: customer.neighborhood || undefined,
                notificationDisabled: false
            };

            // Search on Asaas
            const searchResponse = await axios.get(`${this.baseUrl}/customers?cpfCnpj=${taxId}`, {
                headers: { 'access_token': this.apiKey }
            });

            if (searchResponse.data?.data && searchResponse.data.data.length > 0) {
                const existingId = searchResponse.data.data[0].id;
                const updateResponse = await axios.put(`${this.baseUrl}/customers/${existingId}`, payload, {
                    headers: { 'access_token': this.apiKey }
                });
                return {
                    success: true,
                    customer_id: updateResponse.data.id || existingId,
                    message: 'Cliente atualizado com sucesso no Asaas!'
                };
            } else {
                const createResponse = await axios.post(`${this.baseUrl}/customers`, payload, {
                    headers: { 'access_token': this.apiKey }
                });
                return {
                    success: true,
                    customer_id: createResponse.data.id,
                    message: 'Cliente criado com sucesso no Asaas!'
                };
            }
        } catch (error: any) {
            console.error('Asaas Sync Customer Error:', error.response?.data || error.message);
            const detail = error.response?.data?.errors?.[0]?.description || error.message;
            return {
                success: false,
                message: `Erro ao sincronizar com o Asaas: ${detail}`
            };
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
                const existingId = searchResponse.data.data[0].id;
                try {
                    await axios.put(`${this.baseUrl}/customers/${existingId}`, {
                        name: customer.name,
                        email: customer.email,
                        phone: (customer.phone || '').replace(/\D/g, '') || undefined,
                        mobilePhone: (customer.mobilePhone || customer.phone || '').replace(/\D/g, '') || undefined
                    }, {
                        headers: { 'access_token': this.apiKey }
                    });
                } catch (updErr) {
                    console.warn('Não foi possível atualizar dados do cliente no Asaas durante cobrança:', updErr);
                }
                return existingId;
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
