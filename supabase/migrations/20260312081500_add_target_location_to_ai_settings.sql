-- Migration: Add target_location to AI settings
-- Date: 2026-03-12

ALTER TABLE public.company_ai_settings ADD COLUMN IF NOT EXISTS target_location TEXT DEFAULT 'Brasil';
