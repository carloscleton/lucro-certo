-- Update Admin RPCs to include and manage status
-- This ensures the UI toggles work with the new blocking system

-- 1. Update User List RPC
DROP FUNCTION IF EXISTS public.get_admin_users_list();

CREATE OR REPLACE FUNCTION public.get_admin_users_list()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    user_type TEXT,
    created_at TIMESTAMPTZ,
    quotes_count BIGINT,
    transactions_count BIGINT,
    banned_until TIMESTAMPTZ,
    max_companies INTEGER,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.full_name,
        p.user_type,
        p.created_at,
        (SELECT COUNT(*) FROM quotes q WHERE q.user_id = p.id) as quotes_count,
        (SELECT COUNT(*) FROM transactions t WHERE t.user_id = p.id) as transactions_count,
        p.banned_until,
        COALESCE(p.max_companies, 1) as max_companies,
        COALESCE(p.status, 'active') as status
    FROM profiles p
    ORDER BY p.created_at DESC;
END;
$$;

-- 2. Update User Ban RPC
CREATE OR REPLACE FUNCTION public.admin_toggle_user_ban(target_user_id UUID, should_ban BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF should_ban THEN
        UPDATE public.profiles
        SET 
            banned_until = '9999-12-31 23:59:59+00',
            status = 'blocked'
        WHERE id = target_user_id;
    ELSE
        UPDATE public.profiles
        SET 
            banned_until = NULL,
            status = 'active'
        WHERE id = target_user_id;
    END IF;
END;
$$;

-- 3. Update Company List RPC
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
    status TEXT
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
        COALESCE(c.status, 'active') as status
    FROM public.companies c
    LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    ORDER BY c.created_at DESC;
END;
$$;

-- 4. New RPC to toggle company status
CREATE OR REPLACE FUNCTION public.admin_toggle_company_status(target_company_id UUID, should_block BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_email TEXT;
BEGIN
    caller_email := auth.jwt() ->> 'email';
    
    -- Check if caller is system admin
    IF caller_email IS NULL OR TRIM(LOWER(caller_email)) != 'carloscleton.nat@gmail.com' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF should_block THEN
        UPDATE public.companies
        SET status = 'blocked'
        WHERE id = target_company_id;
    ELSE
        UPDATE public.companies
        SET status = 'active'
        WHERE id = target_company_id;
    END IF;
END;
$$;
