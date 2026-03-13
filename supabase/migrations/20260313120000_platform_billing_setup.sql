-- Migration to add platform billing and subscription support

-- 1. Add platform billing settings to app_settings
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS platform_billing_provider TEXT DEFAULT 'asaas', -- 'asaas', 'stripe', 'mercadopago'
ADD COLUMN IF NOT EXISTS platform_asaas_api_key TEXT,
ADD COLUMN IF NOT EXISTS platform_stripe_api_key TEXT,
ADD COLUMN IF NOT EXISTS platform_mercadopago_api_key TEXT,
ADD COLUMN IF NOT EXISTS platform_asaas_wallet_id TEXT,
ADD COLUMN IF NOT EXISTS billing_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS billing_whatsapp_template TEXT DEFAULT 'Olá, {company_name}! Sua mensalidade do Lucro Certo vence em {days} dias ({due_date}). Evite o bloqueio do sistema clicando no boleto/pix: {payment_link}',
ADD COLUMN IF NOT EXISTS billing_email_template TEXT DEFAULT 'Olá, {company_name}!<br><br>Sua mensalidade do Lucro Certo está próxima do vencimento ({due_date}).<br><br>Valor: {value}<br><br>Para continuar com acesso total às funcionalidades, realize o pagamento pelo link abaixo:<br><a href="{payment_link}">{payment_link}</a><br><br>Atenciosamente,<br>Equipe Lucro Certo',
ADD COLUMN IF NOT EXISTS billing_days_before_reminder INTEGER[] DEFAULT '{5, 2, 0}'; -- 0 means on the due date

-- 2. Add subscription tracking to companies
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_id TEXT, -- External subscription ID from Asaas
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
ADD COLUMN IF NOT EXISTS next_billing_value NUMERIC(10,2) DEFAULT 97.00;

-- 3. Update Admin RPC to include subscription info
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
    crm_module_enabled BOOLEAN,
    has_social_copilot BOOLEAN,
    automations_module_enabled BOOLEAN,
    allowed_entity_types TEXT[],
    settings JSONB,
    logo_url TEXT,
    created_at TIMESTAMPTZ,
    status TEXT,
    subscription_plan TEXT,
    subscription_status TEXT,
    current_period_end TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    next_billing_value NUMERIC(10,2)
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
        COALESCE(c.crm_module_enabled, false) as crm_module_enabled,
        COALESCE(c.has_social_copilot, false) as has_social_copilot,
        COALESCE(c.automations_module_enabled, false) as automations_module_enabled,
        COALESCE(c.allowed_entity_types, ARRAY['PF', 'PJ']) as allowed_entity_types,
        c.settings,
        c.logo_url,
        c.created_at,
        COALESCE(c.status, 'active') as status,
        COALESCE(c.subscription_plan, 'trial') as subscription_plan,
        COALESCE(c.subscription_status, 'active') as subscription_status,
        c.current_period_end,
        c.trial_ends_at,
        COALESCE(c.next_billing_value, 97.00) as next_billing_value
    FROM public.companies c
    LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    ORDER BY c.created_at DESC;
END;
$$;
