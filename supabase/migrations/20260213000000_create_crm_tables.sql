-- CRM MODULE SCHEMA

-- 1. Create CRM Stages Table (Columns for the Kanban board)
CREATE TABLE IF NOT EXISTS public.crm_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#2563eb',
    position SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create CRM Deals Table (Opportunities/Leads)
CREATE TABLE IF NOT EXISTS public.crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES public.crm_stages(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    value DECIMAL(12,2) DEFAULT 0,
    probability SMALLINT DEFAULT 0,
    expected_closing_date DATE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('active', 'won', 'lost')) DEFAULT 'active',
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Add CRM flag and deal_id to existing modules (Integration)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS crm_module_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for crm_stages
DROP POLICY IF EXISTS "Users can manage crm_stages of their company" ON public.crm_stages;
CREATE POLICY "Users can manage crm_stages of their company"
ON public.crm_stages
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = crm_stages.company_id
        AND cm.user_id = auth.uid()
    )
);

-- 6. Create RLS Policies for crm_deals
DROP POLICY IF EXISTS "Users can manage crm_deals of their company" ON public.crm_deals;
CREATE POLICY "Users can manage crm_deals of their company"
ON public.crm_deals
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = crm_deals.company_id
        AND cm.user_id = auth.uid()
    )
);

-- 7. Add default stages function/trigger for new companies (Optional but helpful)
-- For now, let's just provide a manual seed for the user.

-- 8. Add CRM to company settings module if it doesn't exist
-- This is handled via the feature flag logic in the frontend/permissions.
