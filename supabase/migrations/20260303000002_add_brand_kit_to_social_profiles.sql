-- Migration to add Brand Kit fields to social_profiles
ALTER TABLE social_profiles 
ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#4f46e5',
ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#f43f5e';

COMMENT ON COLUMN social_profiles.brand_logo_url IS 'URL of the company logo for watermarking videos and images';
COMMENT ON COLUMN social_profiles.brand_primary_color IS 'Hex code for the primary brand color';
COMMENT ON COLUMN social_profiles.brand_secondary_color IS 'Hex code for the secondary brand color';
