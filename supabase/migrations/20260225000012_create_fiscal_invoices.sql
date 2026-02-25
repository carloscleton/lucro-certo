-- Migração para rastrear notas fiscais (PlugNotas)
CREATE TABLE IF NOT EXISTS public.fiscal_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
    external_id VARCHAR(100), -- ID no PlugNotas
    type VARCHAR(10) NOT NULL, -- 'nfe' ou 'nfse'
    status VARCHAR(50) DEFAULT 'processando',
    pdf_url TEXT,
    xml_url TEXT,
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Users can view invoices of their companies"
ON public.fiscal_invoices FOR SELECT
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage invoices of their companies"
ON public.fiscal_invoices FOR ALL
TO authenticated
USING (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fiscal_invoices_updated_at
    BEFORE UPDATE ON public.fiscal_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Adicionar campo nfe_id nas quotes se não existir (para compatibilidade legada/rápida)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='nfe_id') THEN
        ALTER TABLE public.quotes ADD COLUMN nfe_id VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quotes' AND column_name='nfe_status') THEN
        ALTER TABLE public.quotes ADD COLUMN nfe_status VARCHAR(50);
    END IF;
END $$;
