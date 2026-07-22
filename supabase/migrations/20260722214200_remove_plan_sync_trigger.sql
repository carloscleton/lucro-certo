-- Remove the auto-sync trigger that propagates plan changes to existing companies/profiles
DROP TRIGGER IF EXISTS trg_sync_all_entities_on_plan_update ON public.app_settings;
DROP FUNCTION IF EXISTS public.sync_all_entities_on_plan_update();
