-- Add media_id column to social_posts to track metrics
ALTER TABLE social_posts 
    ADD COLUMN IF NOT EXISTS media_id TEXT;
