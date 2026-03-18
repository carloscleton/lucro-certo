-- Migration: Add lead source percentages to AI settings
ALTER TABLE public.company_ai_settings 
ADD COLUMN IF NOT EXISTS perc_google_maps INTEGER DEFAULT 40,
ADD COLUMN IF NOT EXISTS perc_facebook INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS perc_instagram INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS perc_linkedin INTEGER DEFAULT 20;
