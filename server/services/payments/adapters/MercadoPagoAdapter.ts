import axios from 'axios';
import type { PaymentAdapter, ChargeRequest, PaymentResponse } from '../PaymentAdapter.js';

export class MercadoPagoAdapter implements PaymentAdapter {
    private accessToken: string;
    private baseUrl = 'https://api.mercadopago.com/v1';

    constructor(config: Record<string, any>, isSandbox: boolean = true) {
        // Use environment-specific keys
        const token = isSandbox ? config.sandbox_access_token : config.prod_access_token;

        if (!token) {
            throw new Error(`Mercado Pago Access Token (${isSandbox ? 'Sandbox' : 'Produção'}) não configurado.`);
        }
        this.accessToken = token;
    }

    async createCharge(request: ChargeRequest): Promise<PaymentResponse> {
        try {
            // For PIX, we use direct /payments to get QR Code immediately
            if (request.payment_method === 'pix') {
                const payload = {
                    transaction_amount: request.amount,
                    description: request.description,
                    external_reference: request.external_reference,
                    payment_method_id: 'pix',
                    notification_url: request.notification_url,
                    payer: {
                        email: request.customer.email,
                        first_name: request.customer.name.split(' ')[0],
                        last_name: request.customer.name.split(' ').slice(1).join(' ') || 'Customer',
                        identification: request.customer.tax_id ? {
                            type: request.customer.tax_id.length > 11 ? 'CNPJ' : 'CPF',
                            number: request.customer.tax_id.replace(/\D/g, '')
                        } : undefined
                    }
                };

                const response = await axios.post(`${this.baseUrl}/payments`, payload, {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'X-Idempotency-Key': request.external_reference
                    }
                });

                const data = response.data;
                return {
                    success: true,
                    payment_id: data.id.toString(),
                    qr_code: data.point_of_interaction?.transaction_data?.qr_code,
                    qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
                    payment_link: data.point_of_interaction?.transaction_data?.ticket_url,
                    status: this.mapStatus(data.status)
                };
            }

            // For Credit Card or Boleto, we create a Preference (Checkout Pro)
            // This generates a link that allows the customer to pay
            const preferencePayload = {
                items: [
                    {
                        title: request.description,
                        quantity: 1,
                        unit_price: request.amount,
                        currency_id: 'BRL'
                    }
                ],
                external_reference: request.external_reference,
                notification_url: request.notification_url,
                payer: {
                    email: request.customer.email,
                    name: request.customer.name.split(' ')[0],
                    surname: request.customer.name.split(' ').slice(1).join(' ') || 'Customer',
                    identification: request.customer.tax_id ? {
                        type: request.customer.tax_id.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF',
                        number: request.customer.tax_id.replace(/\D/g, '')
                    } : undefined,
                    phone: {
                        area_code: request.customer.phone?.replace(/\D/g, '').slice(0, 2) || '11',
                        number: request.customer.phone?.replace(/\D/g, '').slice(2) || '999999999'
                    },
                    address: request.customer.address ? {
                        street_name: request.customer.address.street,
                        street_number: request.customer.address.number && !isNaN(parseInt(request.customer.address.number.replace(/\D/g, '')))
                            ? parseInt(request.customer.address.number.replace(/\D/g, ''))
                            : undefined,
                        zip_code: request.customer.address.zip_code?.replace(/\D/g, '')
                    } : undefined
                },
                payment_methods: {
                    included_payment_methods: [
                        { id: request.payment_method === 'boleto' ? 'bolbradesco' : 'visa' } // MP defaults
                    ],
                    excluded_payment_types: request.payment_method === 'credit_card'
                        ? [{ id: 'ticket' }, { id: 'bank_transfer' }]
                        : [{ id: 'credit_card' }, { id: 'debit_card' }]
                },
                back_urls: {
                    success: request.notification_url,
                    pending: request.notification_url,
                    failure: request.notification_url
                },
                auto_return: 'all'
            };

            const prefResponse = await axios.post(`https://api.mercadopago.com/checkout/preferences`, preferencePayload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            return {
                success: true,
                payment_id: prefResponse.data.id,
                payment_link: prefResponse.data.init_point, // Use init_point for redirect
                status: 'pending'
            };

        } catch (error: any) {
            console.error('Mercado Pago Error:', error.response?.data || error.message);
            const detail = error.response?.data?.message || 'Erro ao gerar pagamento no Mercado Pago';
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
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            const data = response.data;

            return {
                success: true,
                payment_id: data.id.toString(),
                status: this.mapStatus(data.status)
            };
        } catch (error: any) {
            console.error('Mercado Pago status check error:', error.message);
            throw error;
        }
    }

    async handleNotification(payload: any): Promise<{ external_reference: string; status: string }> {
        // Mercado Pago sends ID in different places depending on event
        const id = payload.data?.id || payload.id;
        const type = payload.type || payload.topic;

        if (type === 'payment' || payload.topic === 'payment') {
            const response = await axios.get(`${this.baseUrl}/payments/${id}`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            return {
                external_reference: response.data.external_reference,
                status: this.mapStatus(response.data.status)
            };
        }

        throw new Error('Unsupported notification type');
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            // Test access token by fetching payment methods
            const response = await axios.get(`${this.baseUrl}/payment_methods`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            if (response.status === 200) {
                return { success: true, message: 'Conexão estabelecida com sucesso!' };
            }
            return { success: false, message: 'Falha na autenticação com o provedor.' };
        } catch (error: any) {
            console.error('Mercado Pago Connection Test Error:', error.response?.data || error.message);
            const detail = error.response?.data?.message || error.message;
            return { success: false, message: `Erro: ${detail}` };
        }
    }

    private mapStatus(mpStatus: string): 'pending' | 'approved' | 'rejected' | 'cancelled' {
        switch (mpStatus) {
            case 'approved': return 'approved';
            case 'pending':
            case 'in_process': return 'pending';
            case 'rejected': return 'rejected';
            case 'cancelled':
            case 'refunded':
            case 'charged_back': return 'cancelled';
            default: return 'pending';
        }
    }
}
