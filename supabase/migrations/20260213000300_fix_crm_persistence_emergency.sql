-- EMERGENCY FIX: CRM Persistence, updated_at Column, and RPC Robustness
-- 1. Ensure crm_module_enabled column exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='crm_module_enabled') THEN
        ALTER TABLE public.companies ADD COLUMN crm_module_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Ensure updated_at column exists (Fixes "column updated_at does not exist" error)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='updated_at') THEN
        ALTER TABLE public.companies ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 3. Consolidate RPC with better error reporting
DROP FUNCTION IF EXISTS public.admin_update_company_config(UUID, BOOLEAN, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.admin_update_company_config(UUID, BOOLEAN, BOOLEAN, BOOLEAN, JSONB);

CREATE OR REPLACE FUNCTION public.admin_update_company_config(
    target_company_id UUID,
    fiscal_enabled BOOLEAN,
    payments_enabled BOOLEAN,
    crm_enabled BOOLEAN,
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
            'message', 'Unauthorized: ' || COALESCE(caller_email, 'unknown_email')
        );
    END IF;

    UPDATE public.companies
    SET 
        fiscal_module_enabled = fiscal_enabled,
        payments_module_enabled = payments_enabled,
        crm_module_enabled = crm_enabled,
        settings = settings_input,
        updated_at = now()
    WHERE id = target_company_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. Ensure listing returns the column correctly
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
        c.settings,
        c.logo_url,
        c.created_at
    FROM public.companies c
    LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    ORDER BY c.created_at DESC;
END;
$$;
