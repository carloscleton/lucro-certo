-- Migration to add phone_number column to instances table
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS phone_number TEXT;
