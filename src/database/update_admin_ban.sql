-- ATUALIZAÇÃO CRÍTICA: Funções de Admin
-- Execute este script no Supabase SQL Editor para corrigir o bloqueio de usuários.

-- 1. Garante que a função de listar usuários retorne a coluna 'banned_until'
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

-- 2. Garante que a função de banir esteja correta
CREATE OR REPLACE FUNCTION public.admin_toggle_user_ban(target_user_id UUID, should_ban BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF should_ban THEN
        -- Banido infinitamente
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
