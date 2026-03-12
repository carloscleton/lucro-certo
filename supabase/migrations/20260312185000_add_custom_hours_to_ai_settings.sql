-- Migration: Add custom scheduling hours to lead radar
ALTER TABLE public.company_ai_settings 
ADD COLUMN IF NOT EXISTS mining_hour INTEGER DEFAULT 3 CHECK (mining_hour >= 0 AND mining_hour <= 23),
ADD COLUMN IF NOT EXISTS mining_interval_hours INTEGER DEFAULT 5 CHECK (mining_interval_hours >= 1 AND mining_interval_hours <= 168);

COMMENT ON COLUMN public.company_ai_settings.mining_hour IS 'Hora do dia para o agendamento diário (0-23)';
COMMENT ON COLUMN public.company_ai_settings.mining_interval_hours IS 'Intervalo em horas para o agendamento recorrente';
