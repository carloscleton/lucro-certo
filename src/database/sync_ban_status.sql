-- CORREÇÃO DEFINITIVA DE BLOQUEIO
-- Este script conecta o bloqueio visual (Admin) com o bloqueio real (Login do Supabase).

-- Função para Banir/Desbanir sincronizando tables public.profiles e auth.users
CREATE OR REPLACE FUNCTION public.admin_toggle_user_ban(target_user_id UUID, should_ban BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com permissões de admin
AS $$
BEGIN
    IF should_ban THEN
        -- 1. Atualizar perfil público (Visual)
        UPDATE public.profiles
        SET banned_until = '9999-12-31 23:59:59+00'
        WHERE id = target_user_id;

        -- 2. Atualizar sistema de Autenticação (Bloqueio Real de Login)
        UPDATE auth.users
        SET banned_until = '9999-12-31 23:59:59+00'
        WHERE id = target_user_id;
    ELSE
        -- 1. Atualizar perfil público
        UPDATE public.profiles
        SET banned_until = NULL
        WHERE id = target_user_id;

        -- 2. Atualizar sistema de Autenticação
        UPDATE auth.users
        SET banned_until = NULL
        WHERE id = target_user_id;
    END IF;
END;
$$;

-- Permissão para checar se funcinou
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_ban TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_ban TO service_role;
