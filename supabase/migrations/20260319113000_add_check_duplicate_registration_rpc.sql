-- RPC PARA VERIFICAÇÃO DE DUPLICIDADE EM CADASTROS 🛡️
-- Permite que usuários não autenticados verifiquem se CPF/CNPJ ou Email já estão em uso de forma segura.

CREATE OR REPLACE FUNCTION public.check_duplicate_registration(
    document_input TEXT,
    email_input TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    doc_exists BOOLEAN := FALSE;
    mail_exists BOOLEAN := FALSE;
    found_legal_name TEXT;
BEGIN
    -- 1. Check Document (CPF/CNPJ) in companies
    IF document_input IS NOT NULL AND document_input <> '' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.companies 
            WHERE cpf = document_input OR cnpj = document_input
        ) INTO doc_exists;
        
        IF doc_exists THEN
            SELECT legal_name INTO found_legal_name 
            FROM public.companies 
            WHERE (cpf = document_input OR cnpj = document_input)
            LIMIT 1;
        END IF;
    END IF;

    -- 2. Check Email in profiles
    IF email_input IS NOT NULL AND email_input <> '' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE email = email_input
        ) INTO mail_exists;
    END IF;

    RETURN json_build_object(
        'document_exists', doc_exists,
        'email_exists', mail_exists,
        'legal_name', found_legal_name
    );
END;
$$;

-- 3. TRAVAS DE UNICIDADE (Garantia extra)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_cpf_unique') THEN
        ALTER TABLE public.companies ADD CONSTRAINT companies_cpf_unique UNIQUE (cpf);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_cnpj_unique') THEN
        ALTER TABLE public.companies ADD CONSTRAINT companies_cnpj_unique UNIQUE (cnpj);
    END IF;
END $$;
