-- Add platform_whatsapp_instance to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS platform_whatsapp_instance TEXT;
