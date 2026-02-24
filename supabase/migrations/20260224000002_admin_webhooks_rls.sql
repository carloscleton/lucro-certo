-- Single RPC that fetches ALL webhooks from other companies with company names
-- SECURITY DEFINER bypasses RLS entirely — only admin can call it
-- Drop previous attempts
DROP POLICY IF EXISTS "Admin can view all webhooks" ON webhooks;
DROP FUNCTION IF EXISTS get_webhooks_by_company_ids(UUID[]);
DROP FUNCTION IF EXISTS get_template_webhooks(UUID);

CREATE OR REPLACE FUNCTION get_template_webhooks(current_company_id UUID)
RETURNS TABLE (
    id UUID,
    company_id UUID,
    user_id UUID,
    name TEXT,
    url TEXT,
    method TEXT,
    events JSONB,
    headers JSONB,
    auth_username TEXT,
    auth_password TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only the platform admin can call this
    IF (auth.jwt() ->> 'email') != 'carloscleton.nat@gmail.com' THEN
        RAISE EXCEPTION 'Unauthorized: only platform admin can fetch templates';
    END IF;

    RETURN QUERY
    SELECT 
        w.id, w.company_id, w.user_id, w.name, w.url, w.method,
        w.events, w.headers, w.auth_username, w.auth_password,
        w.is_active, w.created_at, w.updated_at,
        c.trade_name as company_name
    FROM webhooks w
    JOIN companies c ON c.id = w.company_id
    WHERE w.company_id != current_company_id
    ORDER BY w.name;
END;
$$;
