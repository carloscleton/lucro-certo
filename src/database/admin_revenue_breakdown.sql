-- ADMIN REVENUE BREAKDOWN AND COMMISSION TRACKING 📊💰

-- 1. Nova Função para Listar Empresas com Faturamento e Comissões
DROP FUNCTION IF EXISTS public.get_admin_companies_list();

CREATE OR REPLACE FUNCTION public.get_admin_companies_list()
RETURNS TABLE (
    id UUID,
    trade_name TEXT,
    legal_name TEXT,
    cnpj TEXT,
    owner_name TEXT,
    owner_email TEXT,
    members_count BIGINT,
    fiscal_module_enabled BOOLEAN,
    payments_module_enabled BOOLEAN,
    settings JSONB,
    logo_url TEXT,
    created_at TIMESTAMPTZ,
    total_revenue NUMERIC,
    commission_earned NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.trade_name,
        c.legal_name,
        c.cnpj,
        p.full_name as owner_name,
        p.email as owner_email,
        (SELECT COUNT(*) FROM public.company_members cm_inner WHERE cm_inner.company_id = c.id) as members_count,
        COALESCE(c.fiscal_module_enabled, false) as fiscal_module_enabled,
        COALESCE(c.payments_module_enabled, false) as payments_module_enabled,
        c.settings,
        c.logo_url,
        c.created_at,
        COALESCE((SELECT SUM(amount) FROM public.transactions t WHERE t.company_id = c.id AND t.type = 'income' AND t.status = 'received'), 0) as total_revenue,
        COALESCE((SELECT SUM(amount * COALESCE((c.settings->>'commission_rate')::numeric, 0) / 100) 
                  FROM public.transactions t 
                  WHERE t.company_id = c.id AND t.type = 'income' AND t.status = 'received'), 0) as commission_earned
    FROM public.companies c
    LEFT JOIN public.company_members cm ON cm.company_id = c.id AND cm.role = 'owner'
    LEFT JOIN public.profiles p ON p.id = cm.user_id
    ORDER BY c.created_at DESC;
END;
$$;

-- 2. Atualizar get_admin_stats para refletir a nova realidade
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _total_users BIGINT;
    _total_companies BIGINT;
    _total_revenue NUMERIC;
    _total_commission NUMERIC;
BEGIN
    SELECT COUNT(*) INTO _total_users FROM profiles;
    SELECT COUNT(*) INTO _total_companies FROM companies;
    
    -- Volume total processado (apenas recebidos)
    SELECT COALESCE(SUM(amount), 0) INTO _total_revenue 
    FROM transactions 
    WHERE type = 'income' AND status = 'received';

    -- Comissão total acumulada (usando as taxas individuais de cada empresa ou 0 se não houver)
    SELECT COALESCE(SUM(t.amount * COALESCE((c.settings->>'commission_rate')::numeric, 0) / 100), 0) INTO _total_commission
    FROM transactions t
    JOIN companies c ON c.id = t.company_id
    WHERE t.type = 'income' AND t.status = 'received';

    RETURN json_build_object(
        'total_users', _total_users,
        'total_companies', _total_companies,
        'total_revenue', _total_revenue,
        'total_commission', _total_commission
    );
END;
$$;
