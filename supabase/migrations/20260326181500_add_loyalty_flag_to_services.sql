-- Add loyalty flag to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_loyalty BOOLEAN DEFAULT FALSE;

-- Update existing services to false (default is already false)
-- COMMENT: This column allows services to be marked as eligible for the Loyalty Club / Recurring Plans.
