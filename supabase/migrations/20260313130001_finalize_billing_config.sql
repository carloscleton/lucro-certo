-- Set default values for platform billing settings
UPDATE public.app_settings 
SET 
  platform_whatsapp_instance = COALESCE(platform_whatsapp_instance, 'MainAdmin'),
  billing_days_before_reminder = COALESCE(billing_days_before_reminder, '{5, 2, 0}'),
  billing_notifications_enabled = COALESCE(billing_notifications_enabled, true)
WHERE id = 1;

-- Also ensure the admin email has the right permissions if needed (though we use logic in hooks)
