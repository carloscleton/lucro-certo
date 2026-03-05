-- Add usage tracking to social_profiles
ALTER TABLE social_profiles 
ADD COLUMN IF NOT EXISTS daily_video_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_video_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS daily_video_limit INTEGER DEFAULT 3;

COMMENT ON COLUMN social_profiles.daily_video_count IS 'Número de vídeos gerados no dia atual';
COMMENT ON COLUMN social_profiles.last_video_date IS 'Data da última geração de vídeo para controle de cota';
COMMENT ON COLUMN social_profiles.daily_video_limit IS 'Limite diário de vídeos permitido para a empresa';
