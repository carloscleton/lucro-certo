-- Add currency column to company_charges
ALTER TABLE public.company_charges
ADD COLUMN currency VARCHAR(3) DEFAULT 'BRL';

-- Existing charges default to BRL
UPDATE public.company_charges SET currency = 'BRL' WHERE currency IS NULL;
