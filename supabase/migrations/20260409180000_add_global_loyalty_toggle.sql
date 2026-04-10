-- Add global loyalty module enabled flag to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT true;

-- Ensure existing settings have it as true
UPDATE public.app_settings SET loyalty_enabled = true WHERE id = 1 AND loyalty_enabled IS NULL;
