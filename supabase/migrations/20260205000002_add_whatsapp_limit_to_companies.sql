-- Migration to add whatsapp_instance_limit to companies table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'whatsapp_instance_limit') THEN
        ALTER TABLE public.companies ADD COLUMN whatsapp_instance_limit INTEGER DEFAULT 1;
    END IF;
END $$;

-- Optional: Function to update the limit for a company (Admin only check in app)
CREATE OR REPLACE FUNCTION public.update_company_whatsapp_limit(target_company_id UUID, new_limit INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function assumes authorization check is handled by the application or RLS
    -- But we can add a hardcoded check for the super admin as requested
    IF auth.jwt() ->> 'email' != 'carloscleton.nat@gmail.com' THEN
        RAISE EXCEPTION 'Unauthorized: Only super admin can change limits';
    END IF;

    UPDATE public.companies
    SET whatsapp_instance_limit = new_limit
    WHERE id = target_company_id;
END;
$$;
