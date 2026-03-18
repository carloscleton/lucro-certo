-- CORREÇÃO: ADICIONA COLUNA 'settings' NA LISTA DE USUÁRIOS DO ADMIN 🛡️
-- Isso resolve o problema das permissões e toggles não salvarem/persistirem no painel.

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
    status TEXT,
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
        COALESCE(p.status, 'active') as status,
        p.settings
    FROM profiles p
    ORDER BY p.created_at DESC;
END;
$$;
