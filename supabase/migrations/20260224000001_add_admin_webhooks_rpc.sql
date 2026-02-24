-- RPC function for admin to fetch webhooks from any company
-- SECURITY DEFINER bypasses RLS so the admin can see webhooks across all companies
CREATE OR REPLACE FUNCTION get_webhooks_by_company_ids(company_ids UUID[])
RETURNS SETOF webhooks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow the platform admin to call this
    IF NOT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND email = 'carloscleton.nat@gmail.com'
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT *
    FROM webhooks
    WHERE company_id = ANY(company_ids)
    ORDER BY name;
END;
$$;
