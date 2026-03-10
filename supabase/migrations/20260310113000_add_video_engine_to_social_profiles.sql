-- Add video engine selection to social_profiles
ALTER TABLE social_profiles 
ADD COLUMN IF NOT EXISTS video_engine TEXT DEFAULT 'google',
ADD COLUMN IF NOT EXISTS video_model TEXT DEFAULT 'kling-v1-6';

COMMENT ON COLUMN social_profiles.video_engine IS 'Motor de vídeo: google ou pollo';
COMMENT ON COLUMN social_profiles.video_model IS 'Modelo específico (ex: kling-v1-6, runway-gen3, etc)';
