export interface PaymentResponse {
    success: boolean;
    payment_id?: string;
    qr_code?: string;
    qr_code_base64?: string;
    payment_link?: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    error?: string;
}

export interface ChargeRequest {
    amount: number;
    description: string;
    external_reference: string;
    customer: {
        name: string;
        email: string;
        tax_id?: string; // CPF/CNPJ
    };
    notification_url?: string;
    payment_method?: 'pix' | 'boleto' | 'credit_card' | 'debit_card' | 'all';
}

export interface PaymentAdapter {
    createCharge(request: ChargeRequest): Promise<PaymentResponse>;
    getPaymentStatus(payment_id: string): Promise<PaymentResponse>;
    handleNotification(payload: any): Promise<{ external_reference: string; status: string }>;
    testConnection(): Promise<{ success: boolean; message: string }>;
}
