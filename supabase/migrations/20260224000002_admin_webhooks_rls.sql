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
    webhook_id UUID,
    webhook_company_id UUID,
    webhook_name TEXT,
    webhook_url TEXT,
    webhook_method TEXT,
    webhook_events JSONB,
    webhook_headers JSONB,
    webhook_is_active BOOLEAN,
    webhook_created_at TIMESTAMPTZ,
    webhook_company_name TEXT
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
        w.id,
        w.company_id,
        w.name::TEXT,
        w.url::TEXT,
        w.method::TEXT,
        w.events,
        COALESCE(w.headers, '{}'::JSONB),
        w.is_active,
        w.created_at,
        COALESCE(c.trade_name, c.legal_name, 'Empresa')::TEXT
    FROM webhooks w
    JOIN companies c ON c.id = w.company_id
    WHERE w.company_id != current_company_id
    ORDER BY w.name;
END;
$$;
