-- Single RPC that fetches ALL webhooks from other companies as templates
-- Available to ANY authenticated user (no admin restriction)
-- Sensitive fields (auth_username, auth_password) are stripped for security
-- SECURITY DEFINER bypasses RLS so any user can see webhooks from any company

-- Clean up previous attempts
DROP POLICY IF EXISTS "Admin can view all webhooks" ON webhooks;
DROP FUNCTION IF EXISTS get_webhooks_by_company_ids(UUID[]);
DROP FUNCTION IF EXISTS get_template_webhooks(UUID);

CREATE OR REPLACE FUNCTION get_template_webhooks(current_company_id UUID)
RETURNS TABLE (
    id UUID,
    company_id UUID,
    name TEXT,
    url TEXT,
    method TEXT,
    events JSONB,
    headers JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Any authenticated user can call this
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    RETURN QUERY
    SELECT 
        w.id, w.company_id, w.name, w.url, w.method,
        w.events, w.headers,
        w.is_active, w.created_at,
        c.trade_name as company_name
    FROM webhooks w
    JOIN companies c ON c.id = w.company_id
    WHERE w.company_id != current_company_id
    ORDER BY w.name;
END;
$$;
