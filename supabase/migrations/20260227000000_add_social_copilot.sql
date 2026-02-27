-- Add social copilot permission flag to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS has_social_copilot BOOLEAN DEFAULT false;
