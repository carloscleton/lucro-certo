-- Migration: Fix AI Settings Policies to allow Owners and Inserts
-- This allows the first-time setup of the AI Agent by the company owner

-- 1. Correct the UPDATE policy to include owners
DROP POLICY IF EXISTS "Admins can update company_ai_settings" ON public.company_ai_settings;
CREATE POLICY "Admins and owners can update company_ai_settings"
ON public.company_ai_settings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_ai_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
);

-- 2. Add INSERT policy so users can create their first AI setup
DROP POLICY IF EXISTS "Admins and owners can insert company_ai_settings" ON public.company_ai_settings;
CREATE POLICY "Admins and owners can insert company_ai_settings"
ON public.company_ai_settings
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_ai_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
);

-- 3. Ensure they can delete if needed (though UI doesn't use it yet)
DROP POLICY IF EXISTS "Admins and owners can delete company_ai_settings" ON public.company_ai_settings;
CREATE POLICY "Admins and owners can delete company_ai_settings"
ON public.company_ai_settings
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_ai_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
);
