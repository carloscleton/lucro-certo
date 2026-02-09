-- Migration to add whatsapp_name column to instances table
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS whatsapp_name TEXT;
