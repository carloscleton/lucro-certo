-- PREVENÇÃO DE DUPLICIDADE EM CADASTROS 🛡️⚖️
-- Garante que CPF e CNPJ sejam únicos na tabela de empresas.

BEGIN;

DO $$ 
BEGIN
    -- 1. Unicidade de CPF
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_cpf_unique') THEN
        ALTER TABLE public.companies ADD CONSTRAINT companies_cpf_unique UNIQUE (cpf);
    END IF;

    -- 2. Unicidade de CNPJ
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_cnpj_unique') THEN
        ALTER TABLE public.companies ADD CONSTRAINT companies_cnpj_unique UNIQUE (cnpj);
    END IF;
END $$;

COMMIT;
