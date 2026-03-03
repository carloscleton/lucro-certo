-- Auto-Pilot and Automation Settings for Phase 8
ALTER TABLE social_profiles 
    ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS autopilot_frequency TEXT DEFAULT 'thrice_weekly', -- daily, thrice_weekly, weekly
    ADD COLUMN IF NOT EXISTS best_posting_times JSONB DEFAULT '[]'::jsonb; -- Suggested HH:MM times based on engagement

-- Add metrics columns to social_posts if not already done in the UI script user just ran
ALTER TABLE social_posts 
    ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS impressions_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reach_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_metrics_sync TIMESTAMPTZ;
