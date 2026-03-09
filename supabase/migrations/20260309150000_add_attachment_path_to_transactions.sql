-- Add attachment_path column to transactions
ALTER TABLE IF EXISTS public.transactions 
ADD COLUMN IF NOT EXISTS attachment_path TEXT;
