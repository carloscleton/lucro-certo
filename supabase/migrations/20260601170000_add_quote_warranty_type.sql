-- Migration to add local warranty_type column to quotes table
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS warranty_type TEXT DEFAULT 'individual';

COMMENT ON COLUMN public.quotes.warranty_type IS 'Modelo de aplicação da garantia deste orçamento (individual ou global)';
