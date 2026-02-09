-- Create Payment Gateways table
CREATE TABLE IF NOT EXISTS public.company_payment_gateways (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'mercado_pago', 'stripe', 'asaas', etc.
    is_active BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Store dynamic credentials
    webhook_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, provider) -- Only one config per provider per company
);

-- Enable RLS
ALTER TABLE public.company_payment_gateways ENABLE ROW LEVEL SECURITY;

-- 1. Allow SELECT for owners and admins of the company
CREATE POLICY "Owners and admins can view payment gateways"
ON public.company_payment_gateways
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_payment_gateways.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- 2. Allow INSERT/UPDATE/DELETE for owners and admins
CREATE POLICY "Owners and admins can manage payment gateways"
ON public.company_payment_gateways
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_payment_gateways.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_payment_gateways.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_payment_gateways_updated_at
    BEFORE UPDATE ON public.company_payment_gateways
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.company_payment_gateways IS 'Configurações dinâmicas de gateways de pagamento por empresa';
COMMENT ON COLUMN public.company_payment_gateways.config IS 'Credenciais e parâmetros específicos do gateway (JSONB)';
