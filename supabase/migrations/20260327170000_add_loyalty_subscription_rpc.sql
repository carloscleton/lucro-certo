-- ================================================================================
-- ATOMIC LOYALTY SUBSCRIPTION UPSERT
-- Created: 2026-03-27
-- Description: Handles subscription creation/update atomically to avoid duplicate keys.
-- ================================================================================

CREATE OR REPLACE FUNCTION upsert_loyalty_subscription(
    p_company_id UUID,
    p_contact_id UUID,
    p_plan_id UUID,
    p_status TEXT,
    p_portal_token TEXT DEFAULT NULL,
    p_next_due_at DATE DEFAULT NULL,
    p_gateway_sub_id TEXT DEFAULT NULL
)
RETURNS SETOF loyalty_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to bypass RLS if needed (or handle it correctly)
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO loyalty_subscriptions (
        company_id,
        contact_id,
        plan_id,
        status,
        portal_token,
        next_due_at,
        gateway_sub_id,
        started_at
    )
    VALUES (
        p_company_id,
        p_contact_id,
        p_plan_id,
        p_status,
        p_portal_token,
        p_next_due_at,
        p_gateway_sub_id,
        NOW()
    )
    ON CONFLICT (company_id, contact_id)
    DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = EXCLUDED.status,
        portal_token = COALESCE(EXCLUDED.portal_token, loyalty_subscriptions.portal_token),
        next_due_at = COALESCE(EXCLUDED.next_due_at, loyalty_subscriptions.next_due_at),
        gateway_sub_id = COALESCE(EXCLUDED.gateway_sub_id, loyalty_subscriptions.gateway_sub_id)
    RETURNING *;
END;
$$;
