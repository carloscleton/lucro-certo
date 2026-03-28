-- ================================================================================
-- SYNCHRONIZE LOYALTY MODULE ENABLED FLAG
-- Created: 2026-03-28
-- Description: Ensures companies.loyalty_module_enabled and 
--              loyalty_settings.enabled are always in sync.
-- ================================================================================

-- 1. Function to sync from companies to loyalty_settings
CREATE OR REPLACE FUNCTION public.sync_loyalty_enabled_to_settings()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.loyalty_module_enabled IS DISTINCT FROM NEW.loyalty_module_enabled) THEN
        INSERT INTO public.loyalty_settings (company_id, enabled)
        VALUES (NEW.id, NEW.loyalty_module_enabled)
        ON CONFLICT (company_id) 
        DO UPDATE SET enabled = EXCLUDED.enabled;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to sync from loyalty_settings to companies
CREATE OR REPLACE FUNCTION public.sync_loyalty_enabled_to_companies()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.enabled IS DISTINCT FROM NEW.enabled) THEN
        UPDATE public.companies
        SET loyalty_module_enabled = NEW.enabled
        WHERE id = NEW.company_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Triggers
DROP TRIGGER IF EXISTS tr_sync_loyalty_to_settings ON public.companies;
CREATE TRIGGER tr_sync_loyalty_to_settings
AFTER UPDATE OF loyalty_module_enabled ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.sync_loyalty_enabled_to_settings();

DROP TRIGGER IF EXISTS tr_sync_loyalty_to_companies ON public.loyalty_settings;
CREATE TRIGGER tr_sync_loyalty_to_companies
AFTER INSERT OR UPDATE OF enabled ON public.loyalty_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_loyalty_enabled_to_companies();

-- 4. Initial Sync (Ensure both are aligned)
UPDATE public.companies c
SET loyalty_module_enabled = ls.enabled
FROM public.loyalty_settings ls
WHERE c.id = ls.company_id AND c.loyalty_module_enabled != ls.enabled;

-- If it exists in companies but not in loyalty_settings, create it
INSERT INTO public.loyalty_settings (company_id, enabled)
SELECT id, loyalty_module_enabled
FROM public.companies
ON CONFLICT (company_id) DO NOTHING;
