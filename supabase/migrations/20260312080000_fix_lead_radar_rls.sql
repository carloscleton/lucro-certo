-- Migration: Fix RLS policies for Lead Radar and AI Settings
-- Date: 2026-03-12

-- 1. Fix company_ai_settings policies
DROP POLICY IF EXISTS "Admins can update company_ai_settings" ON public.company_ai_settings;
CREATE POLICY "Admins and Owners can update company_ai_settings"
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

DROP POLICY IF EXISTS "Super admins can manage company_ai_settings" ON public.company_ai_settings;
CREATE POLICY "Super admins can manage company_ai_settings"
ON public.company_ai_settings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (p.user_type = 'admin' OR p.email = 'carloscleton.nat@gmail.com')
    )
);

-- 2. Ensure radar_leads also has consistent super admin policy
DROP POLICY IF EXISTS "Super admins can manage radar_leads" ON public.radar_leads;
CREATE POLICY "Super admins can manage radar_leads"
ON public.radar_leads
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND (p.user_type = 'admin' OR p.email = 'carloscleton.nat@gmail.com')
    )
);
