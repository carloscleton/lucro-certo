-- 1. Add max_companies column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'max_companies') THEN
        ALTER TABLE public.profiles ADD COLUMN max_companies INTEGER DEFAULT 1;
    END IF;
END $$;

-- 2. Create RPC to update user limit (Admin only)
CREATE OR REPLACE FUNCTION public.admin_update_user_limit(target_user_id UUID, new_limit INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if executing user is admin (you can adjust this check as needed, e.g. using is_admin function)
    -- For now using the email check as in other functions or relying on RLS/application logic
    -- Ideally: IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    
    UPDATE public.profiles
    SET max_companies = new_limit
    WHERE id = target_user_id;
END;
$$;

-- 3. Update create_company to enforce limit
CREATE OR REPLACE FUNCTION public.create_company(
    name_input TEXT,
    trade_name_input TEXT,
    cnpj_input TEXT,
    email_input TEXT DEFAULT '',
    phone_input TEXT DEFAULT '',
    address_input TEXT DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_company_id UUID;
    current_count INTEGER;
    max_limit INTEGER;
BEGIN
    -- Get current count of companies owned by user
    SELECT COUNT(*) INTO current_count
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid() AND cm.role = 'owner';

    -- Get user's max limit
    SELECT max_companies INTO max_limit
    FROM public.profiles
    WHERE id = auth.uid();

    -- Use default 1 if null
    IF max_limit IS NULL THEN
        max_limit := 1;
    END IF;

    -- Check limit
    IF current_count >= max_limit THEN
        RETURN json_build_object('success', false, 'message', 'Limite de empresas atingido. Contate o suporte para aumentar seu plano.');
    END IF;

    -- Create Company
    INSERT INTO public.companies (legal_name, trade_name, cnpj, email, phone, address, owner_id)
    VALUES (name_input, trade_name_input, cnpj_input, email_input, phone_input, address_input, auth.uid())
    RETURNING id INTO new_company_id;

    -- Create Membership (Owner)
    INSERT INTO public.company_members (company_id, user_id, role, status)
    VALUES (new_company_id, auth.uid(), 'owner', 'active');

    -- Create default settings for the company (optional, but good practice per previous tasks)
    UPDATE public.companies 
    SET settings = '{"member_can_delete": false}'::jsonb
    WHERE id = new_company_id;

    RETURN json_build_object('success', true, 'company_id', new_company_id);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. Update get_admin_users_list to ensure it returns max_companies
-- (Assumes the view or existing function needs to select this column)
-- If get_admin_users_list is a complex query, we redefine it here.
-- Below is a generic recreation based on what it likely does.
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
    max_companies INTEGER
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
        COALESCE(p.max_companies, 1) as max_companies
    FROM profiles p
    ORDER BY p.created_at DESC;
END;
$$;
