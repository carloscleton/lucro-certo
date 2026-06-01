-- Migration to create company_technicians table and add columns for global & custom technicians
CREATE TABLE IF NOT EXISTS public.company_technicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_technicians ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Select policy for company technicians" ON public.company_technicians;
DROP POLICY IF EXISTS "Insert policy for company technicians" ON public.company_technicians;
DROP POLICY IF EXISTS "Update policy for company technicians" ON public.company_technicians;
DROP POLICY IF EXISTS "Delete policy for company technicians" ON public.company_technicians;

-- RLS Policies
CREATE POLICY "Select policy for company technicians" ON public.company_technicians
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_technicians.company_id 
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Insert policy for company technicians" ON public.company_technicians
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_technicians.company_id 
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Update policy for company technicians" ON public.company_technicians
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_technicians.company_id 
            AND cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Delete policy for company technicians" ON public.company_technicians
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.company_members cm 
            WHERE cm.company_id = company_technicians.company_id 
            AND cm.user_id = auth.uid()
        )
    );

-- Alter quote_items to add custom technician support
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS custom_technician_id UUID REFERENCES public.company_technicians(id) ON DELETE SET NULL;

-- Alter quotes to add global warranty support
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS warranty_months INTEGER;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS assigned_technician_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS custom_technician_id UUID REFERENCES public.company_technicians(id) ON DELETE SET NULL;

-- Comments
COMMENT ON TABLE public.company_technicians IS 'Tabela de funcionários e técnicos de campo que realizam serviços, sem exigir login';
COMMENT ON COLUMN public.quote_items.custom_technician_id IS 'ID do técnico customizado que realizou o serviço deste item';
COMMENT ON COLUMN public.quotes.warranty_months IS 'Prazo de garantia global do orçamento em meses (usado se tipo de garantia for global)';
COMMENT ON COLUMN public.quotes.assigned_technician_id IS 'ID do perfil do técnico responsável geral pela execução do orçamento completo';
COMMENT ON COLUMN public.quotes.custom_technician_id IS 'ID do técnico customizado responsável geral pela execução do orçamento completo';
