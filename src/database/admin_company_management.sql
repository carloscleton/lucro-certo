-- SUPER ADMIN: COMPANY MANAGEMENT FUNCTIONS 🏢🛡️

-- First, drop existing functions to allow changing return types
DROP FUNCTION IF EXISTS public.get_admin_companies_list();
DROP FUNCTION IF EXISTS public.admin_update_company_config(UUID, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_update_company_config(UUID, BOOLEAN, BOOLEAN, JSONB);

-- 1. Function to list all companies with metadata for the Super Admin
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
    has_lead_radar BOOLEAN,
    allowed_entity_types TEXT[],
    settings JSONB,
    logo_url TEXT,
    subscription_status TEXT,
    subscription_plan TEXT,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
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
        COALESCE(c.has_lead_radar, false) as has_lead_radar,
        c.allowed_entity_types,
        c.settings,
        c.logo_url,
        c.subscription_status,
        c.subscription_plan,
        c.trial_ends_at,
        c.created_at
    FROM public.companies c
    LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    ORDER BY c.created_at DESC;
END;
$$;

-- 2. Function to update company configuration (Super Admin ONLY)
CREATE OR REPLACE FUNCTION public.admin_update_company_config(
    target_company_id UUID,
    fiscal_enabled BOOLEAN,
    payments_enabled BOOLEAN,
    crm_enabled BOOLEAN,
    marketing_enabled BOOLEAN,
    automations_enabled BOOLEAN,
    lead_radar_enabled BOOLEAN,
    allowed_types TEXT[],
    settings_input JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.companies
    SET 
        fiscal_module_enabled = fiscal_enabled,
        payments_module_enabled = payments_enabled,
        crm_module_enabled = crm_enabled,
        has_social_copilot = marketing_enabled,
        automations_module_enabled = automations_enabled,
        has_lead_radar = lead_radar_enabled,
        allowed_entity_types = allowed_types,
        settings = COALESCE(settings_input, settings)
    WHERE id = target_company_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
