-- Create charges table to track payments
CREATE TABLE IF NOT EXISTS public.company_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL, -- 'mercado_pago', 'stripe', etc.
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    external_reference TEXT UNIQUE NOT NULL, -- Our internal ID (e.g. CHG-20260206-XXXX)
    payment_method VARCHAR(50), -- 'pix', 'credit_card', 'boleto'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'cancelled', 'rejected'
    gateway_id TEXT, -- ID returned by the provider
    payment_link TEXT,
    qr_code TEXT,
    qr_code_base64 TEXT,
    is_sandbox BOOLEAN DEFAULT false,
    quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_charges ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Charges viewable by company members"
    ON public.company_charges FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = company_charges.company_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Charges manageable by company admins/owners"
    ON public.company_charges FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members 
            WHERE company_id = company_charges.company_id 
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_charges_updated_at
    BEFORE UPDATE ON public.company_charges
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
