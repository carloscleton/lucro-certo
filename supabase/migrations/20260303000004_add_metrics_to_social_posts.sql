-- Metric Columns for Social Posts
ALTER TABLE social_posts 
    ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS impressions_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reach_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_metrics_sync TIMESTAMPTZ;
