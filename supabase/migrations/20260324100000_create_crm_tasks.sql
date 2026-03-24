-- CRM TASKS / AGENDA MODULE
-- This table stores appointments, reminders, and generic tasks linked to leads, CRM deals, and contacts.

CREATE TABLE IF NOT EXISTS public.crm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    
    -- Categorization
    task_type TEXT CHECK (task_type IN ('call', 'meeting', 'email', 'task', 'payment', 'other')) DEFAULT 'task',
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'canceled')) DEFAULT 'pending',
    priority TEXT CHECK (priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
    
    -- Relationships (Flexible, tasks can be standalone or linked)
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.radar_leads(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    
    -- For Evolution API integration later (like message_id or job_id for reminders)
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Active company members can manage crm_tasks" ON public.crm_tasks;
CREATE POLICY "Active company members can manage crm_tasks"
ON public.crm_tasks
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = crm_tasks.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

-- Super admin bypass
DROP POLICY IF EXISTS "Super admins can manage crm_tasks" ON public.crm_tasks;
CREATE POLICY "Super admins can manage crm_tasks"
ON public.crm_tasks
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.user_type = 'super_admin'
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_crm_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_crm_tasks_updated_at ON public.crm_tasks;
CREATE TRIGGER update_crm_tasks_updated_at
    BEFORE UPDATE ON public.crm_tasks
    FOR EACH ROW
    EXECUTE PROCEDURE update_crm_tasks_updated_at();

-- Indices for performance (frequent searches)
CREATE INDEX IF NOT EXISTS idx_crm_tasks_company_id ON public.crm_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to ON public.crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON public.crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_deal_id ON public.crm_tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_lead_id ON public.crm_tasks(lead_id);
