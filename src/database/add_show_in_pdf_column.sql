-- Add show_in_pdf column to services table
ALTER TABLE services
ADD COLUMN IF NOT EXISTS show_in_pdf BOOLEAN DEFAULT true;

-- Add show_in_pdf column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS show_in_pdf BOOLEAN DEFAULT true;

-- Update existing records to show in PDF by default
UPDATE services
SET show_in_pdf = true
WHERE show_in_pdf IS NULL;

UPDATE products
SET show_in_pdf = true
WHERE show_in_pdf IS NULL;
