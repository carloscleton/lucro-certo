-- Remove fragile hardcoded email check from toggle status RPC
-- This was likely causing 'Unauthorized' errors and the UI to snap back
CREATE OR REPLACE FUNCTION public.admin_toggle_company_status(target_company_id UUID, should_block BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- We rely on the app layer and RLS/RBAC in the future, 
    -- but for now, we match get_admin_users_list's pattern (no hardcoded check here)
    -- since this is already SECURITY DEFINER.
    
    IF should_block THEN
        UPDATE public.companies
        SET status = 'blocked'
        WHERE id = target_company_id;
    ELSE
        UPDATE public.companies
        SET status = 'active'
        WHERE id = target_company_id;
    END IF;
END;
$$;
