-- Migration: Create AI Sales Settings Table
CREATE TABLE IF NOT EXISTS public.company_ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    business_niche TEXT, -- ex: Laboratório, Oficina, etc
    business_description TEXT, -- O "conhecimento" da empresa
    services_catalog JSONB DEFAULT '[]'::jsonb, -- Preços e descrições
    is_active BOOLEAN DEFAULT false,
    auto_approach BOOLEAN DEFAULT false, -- Se envia mensagem automática ao minerar
    daily_lead_quota INTEGER DEFAULT 50, -- Limite de leads por dia
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id)
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_ai_settings_updated_at
    BEFORE UPDATE ON public.company_ai_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS
ALTER TABLE public.company_ai_settings ENABLE ROW LEVEL SECURITY;

-- Policies for company_ai_settings
-- 1. Active members can view their company's AI settings
CREATE POLICY "Active members can view company_ai_settings"
ON public.company_ai_settings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_ai_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

-- 2. Admins can update their company's AI settings
CREATE POLICY "Admins can update company_ai_settings"
ON public.company_ai_settings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_ai_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'active'
    )
);

-- 3. Super admins can do everything
CREATE POLICY "Super admins can manage company_ai_settings"
ON public.company_ai_settings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
);
