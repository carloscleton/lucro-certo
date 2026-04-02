-- Add currency column to companies table
ALTER TABLE public.companies
ADD COLUMN currency VARCHAR(3) DEFAULT 'BRL';

COMMENT ON COLUMN public.companies.currency IS 'ISO 4217 Currency Code (e.g., BRL, USD, EUR, PYG)';

-- Update existing companies to use BRL
UPDATE public.companies SET currency = 'BRL' WHERE currency IS NULL;
