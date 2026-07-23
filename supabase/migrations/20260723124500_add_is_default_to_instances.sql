-- Add is_default column to instances table
ALTER TABLE instances ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
