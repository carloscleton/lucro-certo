-- ================================================================================
-- FIX LOYALTY SUBSCRIPTIONS STARTED_AT COLUMN
-- Created: 2026-03-27
-- Description: Ensures the started_at column exists in loyalty_subscriptions.
-- ================================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'started_at') THEN
        ALTER TABLE loyalty_subscriptions ADD COLUMN started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Also check for next_due_at just in case
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'next_due_at') THEN
        ALTER TABLE loyalty_subscriptions ADD COLUMN next_due_at DATE;
    END IF;
END $$;
