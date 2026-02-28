-- Add Facebook / Instagram Connection Tokens
ALTER TABLE social_profiles 
    ADD COLUMN IF NOT EXISTS fb_access_token TEXT,
    ADD COLUMN IF NOT EXISTS fb_page_id TEXT,
    ADD COLUMN IF NOT EXISTS fb_page_name TEXT,
    ADD COLUMN IF NOT EXISTS ig_account_id TEXT,
    ADD COLUMN IF NOT EXISTS ig_username TEXT;
