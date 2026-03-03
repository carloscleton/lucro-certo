-- Add image_url to social_posts table
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
