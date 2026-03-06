-- Update admin functions to support automations module
-- 1. Update the function to UPDATE company config
DROP FUNCTION IF EXISTS public.admin_update_company_config(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT[], JSONB);

CREATE OR REPLACE FUNCTION public.admin_update_company_config(
    target_company_id UUID,
    fiscal_enabled BOOLEAN,
    payments_enabled BOOLEAN,
    crm_enabled BOOLEAN,
    marketing_enabled BOOLEAN,
    automations_enabled BOOLEAN,
    allowed_types TEXT[],
    settings_input JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_email TEXT;
BEGIN
    caller_email := auth.jwt() ->> 'email';
    
    -- Check if caller is system admin
    IF caller_email IS NULL OR TRIM(LOWER(caller_email)) != 'carloscleton.nat@gmail.com' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Unauthorized'
        );
    END IF;

    UPDATE public.companies
    SET 
        fiscal_module_enabled = fiscal_enabled,
        payments_module_enabled = payments_enabled,
        crm_module_enabled = crm_enabled,
        has_social_copilot = marketing_enabled,
        automations_module_enabled = automations_enabled,
        allowed_entity_types = allowed_types,
        settings = settings_input,
        updated_at = now()
    WHERE id = target_company_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 2. Update the function to LIST companies
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
        COALESCE(c.allowed_entity_types, ARRAY['PF', 'PJ']) as allowed_entity_types,
        c.settings,
        c.logo_url,
        c.created_at
    FROM public.companies c
    LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    ORDER BY c.created_at DESC;
END;
$$;
