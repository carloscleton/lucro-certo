-- RPC PARA VERIFICAR STATUS DE BLOQUEIO DO USUÁRIO OU EMPRESA 🛡️
-- Permite que a tela de login/recuperação de senha verifique se o usuário está suspenso/bloqueado sem expor dados sensíveis.

CREATE OR REPLACE FUNCTION public.check_user_blocked_status(
    email_input TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    prof_id UUID;
    prof_status TEXT;
    comp_status TEXT;
BEGIN
    -- 1. Busca o perfil pelo e-mail (case-insensitive)
    SELECT id, status INTO prof_id, prof_status 
    FROM public.profiles 
    WHERE LOWER(email) = LOWER(TRIM(email_input))
    LIMIT 1;

    -- Se não encontrar o perfil, não está bloqueado
    IF prof_id IS NULL THEN
        RETURN json_build_object(
            'is_blocked', FALSE,
            'reason', 'no_profile'
        );
    END IF;

    -- Administrador Master (Carlos Cleton) nunca é bloqueado
    IF LOWER(TRIM(email_input)) = 'carloscleton.nat@gmail.com' THEN
        RETURN json_build_object(
            'is_blocked', FALSE,
            'reason', 'system_admin'
        );
    END IF;

    -- 2. Verifica se o status do perfil está bloqueado
    IF prof_status = 'blocked' THEN
        RETURN json_build_object(
            'is_blocked', TRUE,
            'reason', 'profile_blocked'
        );
    END IF;

    -- 3. Verifica se a empresa ativa do usuário está bloqueada
    SELECT c.status INTO comp_status 
    FROM public.company_members cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.user_id = prof_id AND cm.status = 'active'
    LIMIT 1;

    IF comp_status = 'blocked' THEN
        RETURN json_build_object(
            'is_blocked', TRUE,
            'reason', 'company_blocked'
        );
    END IF;

    RETURN json_build_object(
        'is_blocked', FALSE,
        'reason', 'active'
    );
END;
$$;
