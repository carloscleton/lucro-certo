-- Add landing_banner configuration to app_settings
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS landing_banner JSONB DEFAULT '{"enabled": false, "title": "", "subtitle": "", "call_to_action": "", "link": "", "type": "promo"}'::jsonb;
