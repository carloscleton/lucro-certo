-- Add birthday and other automation related fields to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add automation settings to companies (if not already handled by JSONB, we just use the JSONB 'settings' column)
-- We'll also add a few more fields to companies to support global automation flags if needed, 
-- but we already have a 'settings' JSONB column in companies, so we'll use that for the flags.

-- Let's ensure 'settings' exists (it should, as per useSettings.ts)
-- If it doesn't, we add it. 
-- In 20260206000010_update_create_company_rpc.sql, companies table is used.
-- Let's check the schema of 'companies' table again to be sure.
