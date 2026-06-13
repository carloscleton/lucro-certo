-- Migration: Add entity_type column to contacts
-- This classifies contacts as 'PF' (Pessoa Física) or 'PJ' (Pessoa Jurídica)

-- 1. Add the entity_type column with a default of 'PF' and a check constraint
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'PF' CHECK (entity_type IN ('PF', 'PJ'));

-- 2. Update existing contacts based on the number of digits in tax_id (CNPJ = 14 digits)
UPDATE public.contacts 
SET entity_type = 'PJ' 
WHERE tax_id IS NOT NULL AND length(regexp_replace(tax_id, '\D', '', 'g')) = 14;
