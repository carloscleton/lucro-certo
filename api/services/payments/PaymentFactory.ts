import type { PaymentAdapter } from './PaymentAdapter';
import { MercadoPagoAdapter } from './adapters/MercadoPagoAdapter';
import { AsaasAdapter } from './adapters/AsaasAdapter';
import { StripeAdapter } from './adapters/StripeAdapter';

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
