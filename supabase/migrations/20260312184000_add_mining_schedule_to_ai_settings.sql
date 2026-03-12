-- Migration: Add automation scheduling to lead radar
ALTER TABLE public.company_ai_settings 
ADD COLUMN IF NOT EXISTS mining_frequency TEXT DEFAULT 'manual' CHECK (mining_frequency IN ('manual', 'daily', 'interval')),
ADD COLUMN IF NOT EXISTS last_mining_at TIMESTAMPTZ;

COMMENT ON COLUMN public.company_ai_settings.mining_frequency IS 'manual = apenas manual, daily = uma vez por dia as 03h, interval = a cada 5 horas';
