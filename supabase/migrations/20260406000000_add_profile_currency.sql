-- Migration: Add currency support to profiles (Pessoa Física)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BRL';

COMMENT ON COLUMN public.profiles.currency IS 'ISO 4217 Currency Code (e.g., BRL, USD, EUR, PYG)';

-- Update existing profiles to use BRL if null
UPDATE public.profiles SET currency = 'BRL' WHERE currency IS NULL;
