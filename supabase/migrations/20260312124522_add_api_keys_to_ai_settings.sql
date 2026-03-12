-- Migration: Add API Keys to AI settings
-- Date: 2026-03-12

ALTER TABLE public.company_ai_settings ADD COLUMN IF NOT EXISTS serper_api_key TEXT;
ALTER TABLE public.company_ai_settings ADD COLUMN IF NOT EXISTS searchapi_api_key TEXT;
