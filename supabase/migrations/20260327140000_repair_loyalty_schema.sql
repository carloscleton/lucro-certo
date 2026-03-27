-- ================================================================================
-- REPAIR LOYALTY SUBSCRIPTIONS SCHEMA
-- Created: 2026-03-27
-- Description: Ensures all columns match the current implementation.
-- ================================================================================

DO $$ 
BEGIN
    -- 1. Fix next_due_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'next_billing_date') THEN
        ALTER TABLE loyalty_subscriptions RENAME COLUMN next_billing_date TO next_due_at;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'next_due_at') THEN
        ALTER TABLE loyalty_subscriptions ADD COLUMN next_due_at DATE;
    END IF;

    -- 2. Fix gateway_sub_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'gateway_subscription_id') THEN
        ALTER TABLE loyalty_subscriptions RENAME COLUMN gateway_subscription_id TO gateway_sub_id;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'gateway_sub_id') THEN
        ALTER TABLE loyalty_subscriptions ADD COLUMN gateway_sub_id TEXT;
    END IF;

    -- 3. Ensure gateway_customer_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'gateway_customer_id') THEN
        ALTER TABLE loyalty_subscriptions ADD COLUMN gateway_customer_id TEXT;
    END IF;

    -- 4. Ensure portal_token exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'portal_token') THEN
        ALTER TABLE loyalty_subscriptions ADD COLUMN portal_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex');
    END IF;
    -- 5. Ensure last_billing_date exists (useful for history)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'last_billing_date') THEN
        ALTER TABLE loyalty_subscriptions ADD COLUMN last_billing_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
