-- Add pdf_url column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Create storage bucket for quote PDFs (run this in Supabase Dashboard → Storage)
-- Bucket name: orcamento-quote-pdfs
-- Public: true
-- File size limit: 10MB
-- Allowed MIME types: application/pdf
