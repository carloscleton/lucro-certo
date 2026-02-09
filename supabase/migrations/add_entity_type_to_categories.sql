-- Add entity_type column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS entity_type TEXT CHECK (entity_type IN ('individual', 'company')) DEFAULT 'individual';

-- Update existing categories to have default value
UPDATE categories SET entity_type = 'individual' WHERE entity_type IS NULL;
