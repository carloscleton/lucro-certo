-- NUCLEAR FIX FOR COMPANIES TABLE AND CREATE_COMPANY RPC 🛠️

-- 1. Ensure all expected columns exist in public.companies
DO $$
BEGIN
    -- Basic Contact Info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'email') THEN
        ALTER TABLE public.companies ADD COLUMN email TEXT DEFAULT '';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'phone') THEN
        ALTER TABLE public.companies ADD COLUMN phone TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'address') THEN
        ALTER TABLE public.companies ADD COLUMN address TEXT DEFAULT '';
    END IF;

    -- Owner Reference (Standardizing on user_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'user_id') THEN
        ALTER TABLE public.companies ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Redefine create_company RPC with absolute safety
CREATE OR REPLACE FUNCTION public.create_company(
    name_input TEXT,
    trade_name_input TEXT,
    cnpj_input TEXT,
    email_input TEXT DEFAULT '',
    phone_input TEXT DEFAULT '',
    address_input TEXT DEFAULT '',
    zip_code_input TEXT DEFAULT NULL,
    street_input TEXT DEFAULT NULL,
    number_input TEXT DEFAULT NULL,
    complement_input TEXT DEFAULT NULL,
    neighborhood_input TEXT DEFAULT NULL,
    city_input TEXT DEFAULT NULL,
    state_input TEXT DEFAULT NULL
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
    -- A. Limit Check
    SELECT COUNT(*) INTO current_count
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid() AND cm.role IN ('owner', 'admin');

    SELECT COALESCE(max_companies, 1) INTO max_limit
    FROM public.profiles
    WHERE id = auth.uid();

    IF current_count >= max_limit THEN
        RETURN json_build_object('success', false, 'message', 'Limite de empresas atingido (' || max_limit || '). Contate o suporte para aumentar seu plano.');
    END IF;

    -- B. Insert Company
    -- Note: We use COALESCE/NULLIF to handle potential missing columns gracefully in the logic, 
    -- but here we assume the ALTER TABLE above succeeded.
    INSERT INTO public.companies (
        legal_name, 
        trade_name, 
        cnpj, 
        email, 
        phone, 
        address, 
        user_id,
        zip_code,
        street,
        number,
        complement,
        neighborhood,
        city,
        state
    )
    VALUES (
        name_input, 
        trade_name_input, 
        cnpj_input, 
        COALESCE(email_input, ''), 
        COALESCE(phone_input, ''), 
        COALESCE(address_input, ''), 
        auth.uid(),
        zip_code_input,
        street_input,
        number_input,
        complement_input,
        neighborhood_input,
        city_input,
        state_input
    )
    RETURNING id INTO new_company_id;

    -- C. Create Membership (Admin)
    INSERT INTO public.company_members (company_id, user_id, role, status)
    VALUES (new_company_id, auth.uid(), 'admin', 'active');

    -- D. Default Settings
    UPDATE public.companies 
    SET settings = jsonb_build_object(
        'member_can_delete', false,
        'modules', jsonb_build_object(
            'dashboard', jsonb_build_object('member', true, 'admin', true),
            'payables', jsonb_build_object('member', true, 'admin', true),
            'receivables', jsonb_build_object('member', true, 'admin', true)
        )
    )
    WHERE id = new_company_id;

    RETURN json_build_object('success', true, 'company_id', new_company_id);

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;
