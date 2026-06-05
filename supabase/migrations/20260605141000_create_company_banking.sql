-- Adiciona o campo de ativação do módulo bancário na tabela de empresas
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS banking_module_enabled BOOLEAN DEFAULT false;
COMMENT ON COLUMN public.companies.banking_module_enabled IS 'Indica se o módulo de integrações bancárias e DDA está ativo para esta empresa';

-- Cria tabela de configurações bancárias por empresa
CREATE TABLE IF NOT EXISTS public.company_banking_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'itau_cnab', 'inter_api', 'stark_api', etc.
    is_active BOOLEAN DEFAULT true,
    dda_enabled BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}'::jsonb, -- Armazena agência, conta, tokens, etc.
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, provider) -- Apenas uma configuração por banco por empresa
);

-- Habilita RLS
ALTER TABLE public.company_banking_configs ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Admins can view company banking configs"
ON public.company_banking_configs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_banking_configs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
);

CREATE POLICY "Admins can manage company banking configs"
ON public.company_banking_configs
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_banking_configs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_banking_configs.company_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_company_banking_configs_updated_at ON public.company_banking_configs;
CREATE TRIGGER update_company_banking_configs_updated_at
    BEFORE UPDATE ON public.company_banking_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE public.company_banking_configs IS 'Configurações de contas bancárias e credenciais de DDA/Pagamento por empresa';
COMMENT ON COLUMN public.company_banking_configs.config IS 'Dados estruturados de agência, conta e credenciais de API/CNAB (JSONB)';


-- =========================================================================
-- ATUALIZAÇÃO DE FUNÇÕES ADMINISTRATIVAS (SUPER ADMIN RPCs)
-- =========================================================================

-- Remove a função antiga para evitar conflitos de assinatura
DROP FUNCTION IF EXISTS public.get_admin_companies_list();

CREATE OR REPLACE FUNCTION public.get_admin_companies_list()
RETURNS TABLE (
    id UUID,
    trade_name TEXT,
    legal_name TEXT,
    cnpj TEXT,
    owner_name TEXT,
    owner_email TEXT,
    members_count BIGINT,
    fiscal_module_enabled BOOLEAN,
    payments_module_enabled BOOLEAN,
    banking_module_enabled BOOLEAN,
    crm_module_enabled BOOLEAN,
    has_social_copilot BOOLEAN,
    has_lead_radar BOOLEAN,
    automations_module_enabled BOOLEAN,
    loyalty_module_enabled BOOLEAN,
    warranty_module_enabled BOOLEAN,
    allowed_entity_types TEXT[],
    settings JSONB,
    logo_url TEXT,
    created_at TIMESTAMPTZ,
    status TEXT,
    subscription_plan TEXT,
    subscription_status TEXT,
    next_billing_value NUMERIC,
    trial_ends_at TIMESTAMPTZ,
    total_revenue NUMERIC,
    commission_earned NUMERIC,
    loyalty_platform_fee NUMERIC,
    loyalty_split_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.trade_name,
        c.legal_name,
        c.cnpj,
        p.full_name as owner_name,
        p.email as owner_email,
        (SELECT COUNT(*) FROM public.company_members cm_inner WHERE cm_inner.company_id = c.id) as members_count,
        COALESCE(c.fiscal_module_enabled, false) as fiscal_module_enabled,
        COALESCE(c.payments_module_enabled, false) as payments_module_enabled,
        COALESCE(c.banking_module_enabled, false) as banking_module_enabled,
        COALESCE(c.crm_module_enabled, false) as crm_module_enabled,
        COALESCE(c.has_social_copilot, false) as has_social_copilot,
        COALESCE(c.has_lead_radar, false) as has_lead_radar,
        COALESCE(c.automations_module_enabled, false) as automations_module_enabled,
        COALESCE(c.loyalty_module_enabled, false) as loyalty_module_enabled,
        COALESCE(c.warranty_module_enabled, false) as warranty_module_enabled,
        COALESCE(c.allowed_entity_types, ARRAY['PF', 'PJ']) as allowed_entity_types,
        c.settings,
        c.logo_url,
        c.created_at,
        COALESCE(c.status, 'active') as status,
        COALESCE(c.subscription_plan, 'trial') as subscription_plan,
        COALESCE(c.subscription_status, 'active') as subscription_status,
        COALESCE(c.next_billing_value, 97.00) as next_billing_value,
        c.trial_ends_at,
        -- BI Data
        COALESCE((SELECT SUM(amount) FROM public.transactions t WHERE t.company_id = c.id AND t.type = 'income' AND t.status = 'received'), 0) as total_revenue,
        COALESCE((SELECT SUM(amount * COALESCE((c.settings->>'commission_rate')::numeric, 0) / 100) 
                  FROM public.transactions t 
                  WHERE t.company_id = c.id AND t.type = 'income' AND t.status = 'received'), 0) as commission_earned,
        -- Loyalty Fee
        COALESCE((SELECT platform_fee_percent FROM public.loyalty_settings ls WHERE ls.company_id = c.id), 5.00) as loyalty_platform_fee,
        COALESCE((SELECT split_enabled FROM public.loyalty_settings ls WHERE ls.company_id = c.id), false) as loyalty_split_enabled
    FROM public.companies c
    LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    ORDER BY c.created_at DESC;
END;
$$;


-- Remove a assinatura antiga do update config para evitar conflitos
DROP FUNCTION IF EXISTS public.admin_update_company_config(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text[],jsonb,boolean,numeric,boolean,boolean);

CREATE OR REPLACE FUNCTION public.admin_update_company_config(
    target_company_id UUID,
    fiscal_enabled BOOLEAN,
    payments_enabled BOOLEAN,
    banking_enabled BOOLEAN,
    crm_enabled BOOLEAN,
    marketing_enabled BOOLEAN,
    automations_enabled BOOLEAN,
    lead_radar_enabled BOOLEAN,
    allowed_types TEXT[],
    settings_input JSONB DEFAULT NULL,
    loyalty_enabled BOOLEAN DEFAULT FALSE,
    loyalty_fee_input NUMERIC DEFAULT 5.00,
    loyalty_split_enabled_input BOOLEAN DEFAULT FALSE,
    warranty_enabled BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update Companies table
    UPDATE public.companies
    SET 
        fiscal_module_enabled = fiscal_enabled,
        payments_module_enabled = payments_enabled,
        banking_module_enabled = banking_enabled,
        crm_module_enabled = crm_enabled,
        has_social_copilot = marketing_enabled,
        automations_module_enabled = automations_enabled,
        has_lead_radar = lead_radar_enabled,
        loyalty_module_enabled = loyalty_enabled,
        warranty_module_enabled = warranty_enabled,
        allowed_entity_types = allowed_types,
        settings = COALESCE(settings_input, settings)
    WHERE id = target_company_id;

    -- Upsert Loyalty Settings (platform_fee_percent and split_enabled)
    INSERT INTO public.loyalty_settings (company_id, platform_fee_percent, split_enabled)
    VALUES (target_company_id, loyalty_fee_input, loyalty_split_enabled_input)
    ON CONFLICT (company_id) 
    DO UPDATE SET 
        platform_fee_percent = EXCLUDED.platform_fee_percent,
        split_enabled = EXCLUDED.split_enabled;

    RETURN jsonb_build_object('success', true);
END;
$$;
