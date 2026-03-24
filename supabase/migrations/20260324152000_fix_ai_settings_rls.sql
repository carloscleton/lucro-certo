-- Migration: Fix AI Settings Policies to allow Owners and Inserts
-- This allows the first-time setup of the AI Agent by the company owner

-- 1. Limpa as regras antigas se elas existirem (Garante idempotência)
DROP POLICY IF EXISTS "Admins can update company_ai_settings" ON public.company_ai_settings;
DROP POLICY IF EXISTS "Admins and owners can update company_ai_settings" ON public.company_ai_settings;
DROP POLICY IF EXISTS "Admins and owners can insert company_ai_settings" ON public.company_ai_settings;

-- 2. Cria a regra de Edição (Dono e Admin)
CREATE POLICY "Admins and owners can update company_ai_settings"
ON public.company_ai_settings FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_ai_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
);

-- 3. Cria a regra de Criação (Dono e Admin)
CREATE POLICY "Admins and owners can insert company_ai_settings"
ON public.company_ai_settings FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = company_ai_settings.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
);
