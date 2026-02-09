-- Update create_company RPC to support granular address fields
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
        email_input, 
        phone_input, 
        address_input, 
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

    -- Create Membership (Owner)
    INSERT INTO public.company_members (company_id, user_id, role, status)
    VALUES (new_company_id, auth.uid(), 'owner', 'active');

    -- Create default settings for the company
    UPDATE public.companies 
    SET settings = '{"member_can_delete": false}'::jsonb
    WHERE id = new_company_id;

    RETURN json_build_object('success', true, 'company_id', new_company_id);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;
