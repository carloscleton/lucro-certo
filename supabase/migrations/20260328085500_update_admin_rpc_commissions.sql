-- ================================================================================
-- UPDATE ADMIN RPC FOR COMMISSIONS
-- Created: 2026-03-28
-- Description: Centralizes budget and loyalty club commission configurations.
-- ================================================================================

-- 1. Update Companies List Function to include loyalty_platform_fee
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
    has_lead_radar BOOLEAN,
    automations_module_enabled BOOLEAN,
    loyalty_module_enabled BOOLEAN,
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
    loyalty_platform_fee NUMERIC
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
        COALESCE(c.has_lead_radar, false) as has_lead_radar,
        COALESCE(c.automations_module_enabled, false) as automations_module_enabled,
        COALESCE(c.loyalty_module_enabled, false) as loyalty_module_enabled,
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
        COALESCE((SELECT platform_fee_percent FROM public.loyalty_settings ls WHERE ls.company_id = c.id), 5.00) as loyalty_platform_fee
    FROM public.companies c
    LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    ORDER BY c.created_at DESC;
END;
$$;

-- 2. Update Consolidated Update Function to handle loyalty fee
DROP FUNCTION IF EXISTS public.admin_update_company_config(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text[],jsonb,boolean);
CREATE OR REPLACE FUNCTION public.admin_update_company_config(
    target_company_id UUID,
    fiscal_enabled BOOLEAN,
    payments_enabled BOOLEAN,
    crm_enabled BOOLEAN,
    marketing_enabled BOOLEAN,
    automations_enabled BOOLEAN,
    lead_radar_enabled BOOLEAN,
    allowed_types TEXT[],
    settings_input JSONB DEFAULT NULL,
    loyalty_enabled BOOLEAN DEFAULT FALSE,
    loyalty_fee_input NUMERIC DEFAULT 5.00
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
        crm_module_enabled = crm_enabled,
        has_social_copilot = marketing_enabled,
        automations_module_enabled = automations_enabled,
        has_lead_radar = lead_radar_enabled,
        loyalty_module_enabled = loyalty_enabled,
        allowed_entity_types = allowed_types,
        settings = COALESCE(settings_input, settings)
    WHERE id = target_company_id;

    -- Upsert Loyalty Settings (platform_fee_percent)
    INSERT INTO public.loyalty_settings (company_id, platform_fee_percent)
    VALUES (target_company_id, loyalty_fee_input)
    ON CONFLICT (company_id) 
    DO UPDATE SET platform_fee_percent = EXCLUDED.platform_fee_percent;

    RETURN jsonb_build_object('success', true);
END;
$$;
