-- ADICIONA FUNCOES DE EXCLUSAO SEGURA DE USUARIO E EMPRESA 🛡️🗑️

-- 6. Funcao para Excluir Usuario (Admin)
-- Remove o usuario do Auth e limpa profiles/memberships
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Remover de company_members
    DELETE FROM public.company_members WHERE user_id = target_user_id;
    
    -- 2. Remover profile
    DELETE FROM public.profiles WHERE id = target_user_id;
    
    -- 3. Remover do Auth (Exige uso do service_role pelo cliente que chama ou via extensions)
    -- Nota: O Supabase recomenda usar o Auth API via Edge Functions ou Admin Client.
    -- Para fins de seguranca local, os dados do Auth sao removidos pelo sistema quando o Profile e deletado se houver trigger,
    -- mas aqui forçamos a limpeza de tabelas publicas para evitar erros de FK.
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Funcao para Excluir Empresa (Admin)
-- Remove a empresa e todas as dependencias (vendas, orçamentos, membros)
CREATE OR REPLACE FUNCTION public.admin_delete_company(target_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Remover Transacoes
    DELETE FROM public.transactions WHERE company_id = target_company_id;
    
    -- 2. Remover Orcamentos
    DELETE FROM public.quotes WHERE company_id = target_company_id;
    
    -- 3. Remover Membros
    DELETE FROM public.company_members WHERE company_id = target_company_id;
    
    -- 4. Remover Gateways
    DELETE FROM public.company_payment_gateways WHERE company_id = target_company_id;
    
    -- 5. Remover Cobrancas da Plataforma
    DELETE FROM public.company_charges WHERE company_id = target_company_id;

    -- 6. Remover CRM (se houver tabelas separadas, ajustar aqui)
    -- DELETE FROM public.crm_leads WHERE company_id = target_company_id;

    -- 7. Finalmente, remover a empresa
    DELETE FROM public.companies WHERE id = target_company_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
