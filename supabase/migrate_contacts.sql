-- ====================================================================
-- MIGRATION SCRIPT FOR EXISTING CONTACTS
-- ====================================================================
-- This script associates all your existing unassigned contacts (company_id = NULL)
-- with their respective companies based on their transaction, quote, and CRM deal history.
-- 
-- How to run:
-- 1. Go to your Supabase Dashboard.
-- 2. Open the SQL Editor.
-- 3. Paste this script and click "Run".
-- ====================================================================

DO $$
DECLARE
    migrated_tx INT;
    migrated_quotes INT;
    migrated_deals INT;
BEGIN
    -- 1. Associate contacts using transaction history
    WITH tx_mapping AS (
        SELECT DISTINCT ON (contact_id) contact_id, company_id
        FROM public.transactions
        WHERE contact_id IS NOT NULL AND company_id IS NOT NULL
        ORDER BY contact_id, created_at DESC
    )
    UPDATE public.contacts c
    SET company_id = m.company_id
    FROM tx_mapping m
    WHERE c.id = m.contact_id
      AND c.company_id IS NULL;
      
    GET DIAGNOSTICS migrated_tx = ROW_COUNT;
    RAISE NOTICE 'Migrated % contacts via Transaction History', migrated_tx;

    -- 2. Associate remaining contacts using quote history
    WITH quote_mapping AS (
        SELECT DISTINCT ON (contact_id) contact_id, company_id
        FROM public.quotes
        WHERE contact_id IS NOT NULL AND company_id IS NOT NULL
        ORDER BY contact_id, created_at DESC
    )
    UPDATE public.contacts c
    SET company_id = m.company_id
    FROM quote_mapping m
    WHERE c.id = m.contact_id
      AND c.company_id IS NULL;

    GET DIAGNOSTICS migrated_quotes = ROW_COUNT;
    RAISE NOTICE 'Migrated % contacts via Quote History', migrated_quotes;

    -- 3. Associate remaining contacts using CRM deal history
    WITH deal_mapping AS (
        SELECT DISTINCT ON (contact_id) contact_id, company_id
        FROM public.crm_deals
        WHERE contact_id IS NOT NULL AND company_id IS NOT NULL
        ORDER BY contact_id, created_at DESC
    )
    UPDATE public.contacts c
    SET company_id = m.company_id
    FROM deal_mapping m
    WHERE c.id = m.contact_id
      AND c.company_id IS NULL;

    GET DIAGNOSTICS migrated_deals = ROW_COUNT;
    RAISE NOTICE 'Migrated % contacts via CRM Deals History', migrated_deals;
END $$;
