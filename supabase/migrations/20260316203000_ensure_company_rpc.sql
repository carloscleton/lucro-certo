-- RPC para garantir que o usuário tenha um company_id vinculado (Auto-Healing)
CREATE OR REPLACE FUNCTION public.ensure_company_for_user()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    found_company_id UUID;
BEGIN
    -- 1. Tentar encontrar vínculo ativo
    SELECT company_id INTO found_company_id
    FROM public.company_members
    WHERE user_id = auth.uid() AND status = 'active'
    ORDER BY role = 'owner' DESC, created_at ASC
    LIMIT 1;

    -- 2. Retornar o ID encontrado (pode ser NULL se nada existir)
    RETURN found_company_id;
END;
$$;
