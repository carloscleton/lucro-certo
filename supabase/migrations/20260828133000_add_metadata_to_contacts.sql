-- Add metadata JSONB column to contacts table
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb NOT NULL;
