import Stripe from 'stripe';
import type { PaymentAdapter, ChargeRequest, PaymentResponse } from '../PaymentAdapter.js';

export class StripeAdapter implements PaymentAdapter {
    private stripe: Stripe;
    private isSandbox: boolean;

    constructor(config: Record<string, any>, isSandbox: boolean = true) {
        const secretKey = isSandbox ? config.sandbox_secret_key : config.prod_secret_key;
        this.isSandbox = isSandbox;

        if (!secretKey) {
            throw new Error(`Stripe Secret Key (${isSandbox ? 'Sandbox' : 'Produção'}) não configurada.`);
        }

        this.stripe = new Stripe(secretKey, {
            apiVersion: '2023-10-16' as any,
        });
    }

    async createCharge(request: ChargeRequest): Promise<PaymentResponse> {
        try {
            // Stripe typically uses Checkout Sessions for a managed payment page
            const methodTypes: string[] = ['card'];
            if (request.payment_method === 'pix') methodTypes.push('pix');
            if (request.payment_method === 'boleto') methodTypes.push('boleto');

            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: methodTypes,
                line_items: [{
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: request.description,
                        },
                        unit_amount: Math.round(request.amount * 100), // Stripe uses cents
                    },
                    quantity: 1,
                }],
                payment_method_options: {
                    pix: {
                        expires_after_seconds: 86400 // 24h
                    }
                },
                mode: 'payment',
                success_url: `${request.notification_url}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: request.notification_url,
                customer_email: request.customer.email,
                metadata: {
                    external_reference: request.external_reference
                }
            } as any);

            const result: PaymentResponse = {
                success: true,
                payment_id: session.id,
                status: 'pending'
            };

            if (session.url) {
                result.payment_link = session.url;
            }

            return result;

        } catch (error: any) {
            console.error('Stripe Error:', error.message);
            return {
                success: false,
                status: 'rejected',
                error: error.message
            };
        }
    }

    async getPaymentStatus(payment_id: string): Promise<PaymentResponse> {
        try {
            const session = await this.stripe.checkout.sessions.retrieve(payment_id);

            return {
                success: true,
                payment_id: session.id,
                status: this.mapStatus(session.payment_status, session.status)
            };
        } catch (error: any) {
            console.error('Stripe status check error:', error.message);
            throw error;
        }
    }

    async handleNotification(payload: any): Promise<{ external_reference: string; status: string }> {
        // Stripe webhooks send Event objects. We usually look for checkout.session.completed
        const event = payload as Stripe.Event;

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            return {
                external_reference: session.metadata?.external_reference || '',
                status: 'approved'
            };
        }

        if (event.type === 'payment_intent.payment_failed') {
            const intent = event.data.object as Stripe.PaymentIntent;
            return {
                external_reference: intent.metadata?.external_reference || '',
                status: 'rejected'
            };
        }

        throw new Error(`Unhandled Stripe event type: ${event.type}`);
    }

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            // Verify connection by retrieving account balance (requires secret key)
            await this.stripe.balance.retrieve();

            return { success: true, message: 'Conexão com Stripe estabelecida!' };
        } catch (error: any) {
            console.error('Stripe Connection Test Error:', error.message);
            return { success: false, message: `Erro no Stripe: ${error.message}` };
        }
    }

    private mapStatus(paymentStatus: string, sessionStatus: string | null): 'pending' | 'approved' | 'rejected' | 'cancelled' {
        if (paymentStatus === 'paid') return 'approved';
        if (sessionStatus === 'expired') return 'cancelled';
        if (paymentStatus === 'unpaid' && sessionStatus === 'open') return 'pending';
        return 'pending';
    }
}
