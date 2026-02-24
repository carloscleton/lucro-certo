-- Single RPC that fetches ALL webhooks from other companies as templates
-- Returns JSON to avoid ANY type mismatch issues
-- Available to ANY authenticated user
-- SECURITY DEFINER bypasses RLS

-- Clean up ALL previous attempts
DROP POLICY IF EXISTS "Admin can view all webhooks" ON webhooks;
DROP FUNCTION IF EXISTS get_webhooks_by_company_ids(UUID[]);
DROP FUNCTION IF EXISTS get_template_webhooks(UUID);

CREATE OR REPLACE FUNCTION get_template_webhooks(current_company_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Any authenticated user can call this
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT json_agg(row_to_json(t))
    INTO result
    FROM (
        SELECT 
            w.id,
            w.company_id,
            w.name,
            w.url,
            w.method,
            w.events,
            w.headers,
            w.is_active,
            w.created_at,
            c.trade_name as company_name
        FROM webhooks w
        JOIN companies c ON c.id = w.company_id
        WHERE w.company_id != current_company_id
        ORDER BY w.name
    ) t;

    RETURN COALESCE(result, '[]'::JSON);
END;
$$;
