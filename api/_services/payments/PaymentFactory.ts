import type { PaymentAdapter } from './PaymentAdapter.js';
import { MercadoPagoAdapter } from './adapters/MercadoPagoAdapter.js';
import { AsaasAdapter } from './adapters/AsaasAdapter.js';
import { StripeAdapter } from './adapters/StripeAdapter.js';

export class PaymentFactory {
    private static adapters: Record<string, any> = {
        'mercado_pago': MercadoPagoAdapter,
        'asaas': AsaasAdapter,
        'stripe': StripeAdapter,
    };

    static getAdapter(provider: string, config: any, isSandbox: boolean = true): PaymentAdapter {
        const AdapterClass = this.adapters[provider];
        if (!AdapterClass) {
            throw new Error(`Provider ${provider} not supported or implemented yet.`);
        }
        return new AdapterClass(config, isSandbox);
    }
}
