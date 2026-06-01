-- Migration to add local warranty_terms column to quotes table
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS warranty_terms TEXT;

COMMENT ON COLUMN public.quotes.warranty_terms IS 'Termos personalizados da garantia / certificado de garantia do serviço';
