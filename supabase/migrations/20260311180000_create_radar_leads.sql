-- LEADS RADAR MODULE
-- This table stores potential customers found by the AI Prospecting Agent

CREATE TABLE IF NOT EXISTS public.radar_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    
    -- External Reference
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'google_maps', 'whatsapp', 'linkedin', 'custom')),
    external_id TEXT, -- Profile ID, CID, or Handle
    external_url TEXT, -- Link to the profile or post
    
    -- Lead Info
    name TEXT NOT NULL,
    contact_number TEXT,
    location TEXT,
    description TEXT, -- What the lead said or their bio
    
    -- AI Analysis
    score SMALLINT DEFAULT 0, -- 0-100 Qualification score
    ai_summary TEXT, -- Brief summary of why this lead is good
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approached', 'ignored', 'converted', 'blacklisted')),
    
    -- Outreach tracking
    last_approach_at TIMESTAMPTZ,
    approach_count INTEGER DEFAULT 0,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.radar_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Active members can view radar_leads" ON public.radar_leads;
CREATE POLICY "Active members can view radar_leads"
ON public.radar_leads
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = radar_leads.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Admins can manage radar_leads" ON public.radar_leads;
CREATE POLICY "Admins can manage radar_leads"
ON public.radar_leads
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = radar_leads.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
);

DROP POLICY IF EXISTS "Super admins can manage radar_leads" ON public.radar_leads;
CREATE POLICY "Super admins can manage radar_leads"
ON public.radar_leads
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
        AND p.user_type = 'admin'
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_radar_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_radar_leads_updated_at
    BEFORE UPDATE ON public.radar_leads
    FOR EACH ROW
    EXECUTE PROCEDURE update_radar_leads_updated_at();

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_radar_leads_company_id ON public.radar_leads(company_id);
CREATE INDEX IF NOT EXISTS idx_radar_leads_status ON public.radar_leads(status);
CREATE INDEX IF NOT EXISTS idx_radar_leads_created_at ON public.radar_leads(created_at);
