-- ================================================================================
-- ADD UNIQUE CONSTRAINT TO LOYALTY SUBSCRIPTIONS
-- Created: 2026-03-27
-- Description: Cleans up duplicates and adds a unique constraint to support upsert.
-- ================================================================================

DO $$ 
BEGIN
    -- 1. Ensure started_at exists (from previous fix)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loyalty_subscriptions' AND column_name = 'started_at') THEN
        ALTER TABLE loyalty_subscriptions ADD COLUMN started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- 2. Cleanup duplicates: Keep only the most recent subscription per contact/company
    DELETE FROM loyalty_subscriptions a
    USING loyalty_subscriptions b
    WHERE a.id < b.id
      AND a.company_id = b.company_id
      AND a.contact_id = b.contact_id;

    -- 3. Add UNIQUE constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'loyalty_subscriptions_company_id_contact_id_key'
    ) THEN
        ALTER TABLE loyalty_subscriptions 
        ADD CONSTRAINT loyalty_subscriptions_company_id_contact_id_key UNIQUE (company_id, contact_id);
    END IF;

END $$;
