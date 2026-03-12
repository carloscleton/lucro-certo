-- Add email column to radar_leads
ALTER TABLE public.radar_leads ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email searches
CREATE INDEX IF NOT EXISTS idx_radar_leads_email ON public.radar_leads(email);
