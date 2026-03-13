-- ADMIN BI DASHBOARD RPC 📊💹

CREATE OR REPLACE FUNCTION public.get_admin_bi_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
    _revenue_series json;
    _growth_series json;
    _plan_distribution json;
BEGIN
    -- 1. Revenue and Commission over the last 6 months
    SELECT json_agg(t) INTO _revenue_series
    FROM (
        SELECT 
            to_char(date_trunc('month', t.created_at), 'Month YYYY') as month,
            date_trunc('month', t.created_at) as month_date,
            SUM(t.amount) as revenue,
            SUM(t.amount * COALESCE((c.settings->>'commission_rate')::numeric, 0) / 100) as commission
        FROM public.transactions t
        JOIN public.companies c ON c.id = t.company_id
        WHERE t.type = 'income' 
          AND t.status = 'received'
          AND t.created_at >= date_trunc('month', now()) - interval '6 months'
        GROUP BY 1, 2
        ORDER BY 2 ASC
    ) t;

    -- 2. User growth series
    SELECT json_agg(t) INTO _growth_series
    FROM (
        SELECT 
            to_char(date_trunc('month', created_at), 'Month YYYY') as month,
            date_trunc('month', created_at) as month_date,
            COUNT(*) as new_users
        FROM public.profiles
        WHERE created_at >= date_trunc('month', now()) - interval '6 months'
        GROUP BY 1, 2
        ORDER BY 2 ASC
    ) t;

    -- 3. Plan Distribution
    SELECT json_agg(t) INTO _plan_distribution
    FROM (
        SELECT 
            COALESCE(subscription_plan, 'trial') as plan,
            COUNT(*) as total
        FROM public.companies
        GROUP BY 1
    ) t;

    RETURN json_build_object(
        'revenue_series', _revenue_series,
        'growth_series', _growth_series,
        'plan_distribution', _plan_distribution
    );
END;
$func$;
