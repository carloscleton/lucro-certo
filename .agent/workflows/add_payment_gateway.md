---
description: Como adicionar um novo Gateway de Pagamento ao sistema
---

Este guia explica os passos necessários para integrar um novo provedor (ex: PagSeguro, Iugu, Juno) utilizando a arquitetura de **Adapters** e **Factory** já implementada.

### 1. Frontend: Definir o Provedor e Campos
No arquivo `src/components/settings/PaymentSettings.tsx`, adicione a definição do novo gateway à constante `PROVIDERS`:

```tsx
const PROVIDERS = [
    // ... existentes
    { 
        id: 'pagseguro', // ID único que será salvo no banco
        name: 'PagSeguro', 
        fields: [
            { key: 'email', label: 'E-mail da Conta', placeholder: 'seu@email.com' },
            { key: 'token', label: 'Token de API', placeholder: '...', type: 'password' }
        ]
    },
];
```

### 2. Backend: Criar o Adapter
Crie um novo arquivo em `server/services/payments/adapters/NomeDoGatewayAdapter.ts`. O arquivo deve implementar a interface `PaymentAdapter`.

```typescript
import axios from 'axios';
import type { PaymentAdapter, ChargeRequest, PaymentResponse } from '../PaymentAdapter.js';

export class PagSeguroAdapter implements PaymentAdapter {
    private token: string;

    constructor(config: Record<string, any>, isSandbox: boolean = true) {
        // O sistema prefixa as chaves automaticamente com sandbox_ ou prod_
        this.token = isSandbox ? config.sandbox_token : config.prod_token;
        if (!this.token) throw new Error('Token não configurado');
    }

    async createCharge(request: ChargeRequest): Promise<PaymentResponse> {
        // Implemente a chamada de API específica do gateway aqui
        return { success: true, payment_id: '...', status: 'pending' };
    }

    async getPaymentStatus(payment_id: string): Promise<PaymentResponse> {
        // Implemente a consulta de status aqui
        return { success: true, status: 'approved' };
    }

    async handleNotification(payload: any): Promise<{ external_reference: string; status: string }> {
        // Implemente o processamento de Webhook aqui
        return { external_reference: '...', status: 'approved' };
    }
}
```

### 3. Backend: Registrar na Factory
No arquivo `server/services/payments/PaymentFactory.ts`, importe o novo Adapter e adicione-o ao objeto `adapters`:

```typescript
import { PagSeguroAdapter } from './adapters/PagSeguroAdapter.js';

export class PaymentFactory {
    private static adapters: Record<string, any> = {
        'mercado_pago': MercadoPagoAdapter,
        'pagseguro': PagSeguroAdapter, // Adicione aqui
    };
    // ...
}
```

### 4. Testar a Integração
1. Vá em **Configurações > Pagamentos**.
2. O novo gateway aparecerá na lista à esquerda.
3. Configure as chaves de **Teste** e salve.
4. Gere um orçamento e teste o pagamento.

> [!NOTE]
> O banco de dados (`company_payment_gateways`) é genérico e usa JSONB. Você **não** precisa alterar tabelas SQL para adicionar novos provedores.
