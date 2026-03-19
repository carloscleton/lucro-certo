-- DEFAULT PERMISSIONS FOR 7-DAY TRIAL USERS 🛡️📊
-- This script sets the default module and tab access for new users as requested.

CREATE OR REPLACE FUNCTION public.get_default_user_settings()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN jsonb_build_object(
        'modules', jsonb_build_object(
            'dashboard', jsonb_build_object('admin', true, 'member', true),
            'quotes', jsonb_build_object('admin', true, 'member', true),
            'receivables', jsonb_build_object('admin', true, 'member', true),
            'payables', jsonb_build_object('admin', true, 'member', true),
            'categories', jsonb_build_object('admin', true, 'member', true),
            'companies', jsonb_build_object('admin', true, 'member', true),
            'contacts', jsonb_build_object('admin', true, 'member', true),
            'services', jsonb_build_object('admin', true, 'member', true),
            'products', jsonb_build_object('admin', true, 'member', true),
            'whatsapp', jsonb_build_object('admin', true, 'member', true),
            'payments', jsonb_build_object('admin', true, 'member', true),
            'crm', jsonb_build_object('admin', true, 'member', true),
            'marketing', jsonb_build_object('admin', true, 'member', true),
            'lead_radar', jsonb_build_object('admin', true, 'member', true),
            'commissions', jsonb_build_object('admin', false, 'member', false),
            'reports', jsonb_build_object('admin', true, 'member', true),
            'settings', jsonb_build_object('admin', true, 'member', true)
        ),
        'settings_tabs', jsonb_build_object(
            'quotes', jsonb_build_object('admin', true, 'member', false),
            'financial', jsonb_build_object('admin', false, 'member', false),
            'team', jsonb_build_object('admin', true, 'member', false),
            'webhooks', jsonb_build_object('admin', true, 'member', false),
            'whatsapp', jsonb_build_object('admin', true, 'member', false),
            'payments', jsonb_build_object('admin', true, 'member', false),
            'automations', jsonb_build_object('admin', true, 'member', false),
            'subscription', jsonb_build_object('admin', true, 'member', false),
            'platform_billing', jsonb_build_object('admin', false, 'member', false)
        )
    );
END;
$$;

-- Trigger Function to apply defaults on profile creation
CREATE OR REPLACE FUNCTION public.on_profile_created_set_defaults()
RETURNS TRIGGER AS $$
BEGIN
    -- if settings is null, apply defaults
    IF NEW.settings IS NULL OR NEW.settings = '{}'::jsonb THEN
        NEW.settings := public.get_default_user_settings();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach Trigger to Profiles
DROP TRIGGER IF EXISTS on_profile_created_defaults ON public.profiles;
CREATE TRIGGER on_profile_created_defaults
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.on_profile_created_set_defaults();

-- Also apply to existing users with empty settings (Optional but recommended for consistency)
UPDATE public.profiles 
SET settings = public.get_default_user_settings() 
WHERE settings IS NULL OR settings = '{}'::jsonb;
