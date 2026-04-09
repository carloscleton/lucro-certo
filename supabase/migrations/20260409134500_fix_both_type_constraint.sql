-- FIX: PERMISSÃO PARA TIPO 'BOTH' E RECUPERAÇÃO DE PERFIS 🛡️🏗️
-- Este script resolve a falha na criação de perfis quando o usuário escolhe "Ambos".

-- 1. ATUALIZAR A CONSTRAINT DA TABELA 'PROFILES'
-- Removemos a antiga que só aceitava PF/PJ e adicionamos a que aceita BOTH
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type = ANY (ARRAY['PF'::text, 'PJ'::text, 'BOTH'::text]));


-- 2. REPARAR PERFIS FALTANTES (RECOVERY)
-- Este bloco procura por usuários no auth.users que não possuem perfil e os cria retroativamente
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN 
        SELECT id, email, raw_user_meta_data 
        FROM auth.users 
        WHERE id NOT IN (SELECT id FROM public.profiles)
    LOOP
        INSERT INTO public.profiles (
            id, 
            email, 
            full_name, 
            user_type, 
            phone, 
            document, 
            currency, 
            status,
            created_at
        )
        VALUES (
            u.id,
            u.email,
            COALESCE(u.raw_user_meta_data->>'full_name', ''),
            COALESCE(u.raw_user_meta_data->>'user_type', 'PF'),
            u.raw_user_meta_data->>'phone',
            u.raw_user_meta_data->>'document',
            COALESCE(u.raw_user_meta_data->>'currency', 'BRL'),
            'active',
            NOW()
        ) ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;


-- 3. REPROZESAR GATILHO (Para garantir que novos cadastros funcionem)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    phone, 
    document, 
    user_type, 
    currency, 
    status,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'document',
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'PF'),
    COALESCE(NEW.raw_user_meta_data->>'currency', 'BRL'),
    'active',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincroniza cache da API
NOTIFY pgrst, 'reload schema';

DO $$ 
BEGIN 
    RAISE NOTICE 'Constraint atualizada e perfis recuperados com sucesso!'; 
END $$;
