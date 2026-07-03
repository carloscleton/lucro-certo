-- Add customization columns to loyalty_plans table
ALTER TABLE loyalty_plans ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';
ALTER TABLE loyalty_plans ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE;
ALTER TABLE loyalty_plans ADD COLUMN IF NOT EXISTS badge_text TEXT DEFAULT 'Mais Popular';
