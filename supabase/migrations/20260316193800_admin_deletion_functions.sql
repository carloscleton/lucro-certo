-- LIMPA VERSÕES ANTIGAS PARA EVITAR CONFLITO DE TIPOS 🧹
DROP FUNCTION IF EXISTS public.admin_delete_user(target_user_id UUID);
DROP FUNCTION IF EXISTS public.admin_delete_company(target_company_id UUID);

-- 1. Função para Excluir Usuário (Admin)
-- Agora limpa todas as tabelas de dependência conhecidas antes de apagar o perfil
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Limpar configurações de usuário (Dashboard/Temas/etc)
    DELETE FROM public.user_settings WHERE user_id = target_user_id;
    
    -- 2. Limpar vínculos de membros de empresa
    DELETE FROM public.company_members WHERE user_id = target_user_id;
    
    -- 3. Limpar notificações ou outras tabelas que usem user_id se existirem
    -- DELETE FROM public.notifications WHERE user_id = target_user_id;
    
    -- 4. Remover o perfil público
    DELETE FROM public.profiles WHERE id = target_user_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Função para Excluir Empresa (Admin) com Limpeza Inteligente do Dono
-- Se o dono não tiver mais nenhuma empresa, remove também o usuário e seu login
CREATE OR REPLACE FUNCTION public.admin_delete_company(target_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    owner_id UUID;
    other_companies_count INTEGER;
BEGIN
    -- 1. Identificar quem é o dono antes de qualquer exclusão
    SELECT user_id INTO owner_id 
    FROM public.company_members 
    WHERE company_id = target_company_id AND role = 'owner' 
    LIMIT 1;

    -- 2. Limpeza total de dados operacionais
    DELETE FROM public.transactions WHERE company_id = target_company_id;
    DELETE FROM public.quotes WHERE company_id = target_company_id;
    DELETE FROM public.company_members WHERE company_id = target_company_id;
    DELETE FROM public.company_payment_gateways WHERE company_id = target_company_id;
    DELETE FROM public.company_charges WHERE company_id = target_company_id;
    DELETE FROM public.instances WHERE company_id = target_company_id;
    
    -- 3. Remover a própria empresa
    DELETE FROM public.companies WHERE id = target_company_id;

    -- 4. LIMPEZA INTELIGENTE DO USUÁRIO
    -- Se o dono não tiver mais nenhuma empresa vinculada, deletamos ele também
    IF owner_id IS NOT NULL THEN
        SELECT COUNT(*) INTO other_companies_count 
        FROM public.company_members 
        WHERE user_id = owner_id;
        
        IF other_companies_count = 0 THEN
            -- O dono ficou órfão? Deletamos ele (limpa profile, settings e auth automáticamente via admin_delete_user + trigger)
            PERFORM public.admin_delete_user(owner_id);
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'owner_removed', (other_companies_count = 0)
    );
END;
$$;


-- 3. Gatilho para Excluir do Auth automaticamente
-- Quando o profile é removido (pela admin_delete_user), remove também do sistema de Login
CREATE OR REPLACE FUNCTION public.handle_delete_user_auth()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_delete_auth ON public.profiles;
CREATE TRIGGER on_profile_delete_auth
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_delete_user_auth();

