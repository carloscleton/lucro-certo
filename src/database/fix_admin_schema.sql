-- FIX: Garante que todas as colunas necessárias existem
DO $$
BEGIN
    -- 1. Garante coluna 'max_companies'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'max_companies') THEN
        ALTER TABLE public.profiles ADD COLUMN max_companies INTEGER DEFAULT 1;
    END IF;

    -- 2. Garante coluna 'banned_until' (Usada no bloqueio de usuários)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'banned_until') THEN
        ALTER TABLE public.profiles ADD COLUMN banned_until TIMESTAMPTZ;
    END IF;

    -- 3. Garante coluna 'user_type' (Se não existir, cria e define padrão)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'user_type') THEN
        ALTER TABLE public.profiles ADD COLUMN user_type TEXT DEFAULT 'PF';
    END IF;

    -- 4. Garante coluna 'settings' (Para permissões do contexto Pessoal)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'settings') THEN
        ALTER TABLE public.profiles ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 4. Recria a função de listagem de usuários (Admin)
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
    settings JSONB
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
        COALESCE(p.settings, '{}'::jsonb) as settings
    FROM profiles p
    ORDER BY p.created_at DESC;
END;
$$;

-- 5. Função de Atualizar Limite (Admin)
CREATE OR REPLACE FUNCTION public.admin_update_user_limit(target_user_id UUID, new_limit INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET max_companies = new_limit
    WHERE id = target_user_id;
END;
$$;

-- 6. Função para atualizar configurações/permissões do usuário (Admin)
CREATE OR REPLACE FUNCTION public.admin_update_user_config(
    target_user_id UUID,
    settings_input JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET 
        settings = COALESCE(settings_input, settings)
    WHERE id = target_user_id;
END;
$$;

-- 6. Estatísticas do Admin (Retorna JSON único)
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _total_users BIGINT;
    _total_companies BIGINT;
    _total_revenue NUMERIC;
BEGIN
    SELECT COUNT(*) INTO _total_users FROM profiles;
    SELECT COUNT(*) INTO _total_companies FROM companies;
    SELECT COALESCE(SUM(amount), 0) INTO _total_revenue FROM transactions WHERE type = 'income';

    RETURN json_build_object(
        'total_users', _total_users,
        'total_companies', _total_companies,
        'total_revenue', _total_revenue
    );
END;
$$;

-- 7. Função de Excluir Usuário (Admin)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Remove profile (Auth user removal requires different privileges or triggers)
    DELETE FROM public.profiles WHERE id = target_user_id;
END;
$$;

-- 8. Função de Banir/Desbanir Usuário (Admin)
CREATE OR REPLACE FUNCTION public.admin_toggle_user_ban(target_user_id UUID, should_ban BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF should_ban THEN
        -- Banido infinitamente (até o ano 9999)
        UPDATE public.profiles
        SET banned_until = '9999-12-31 23:59:59+00'
        WHERE id = target_user_id;
    ELSE
        -- Remove banimento
        UPDATE public.profiles
        SET banned_until = NULL
        WHERE id = target_user_id;
    END IF;
END;
$$;
