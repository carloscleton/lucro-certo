-- Add video and avatar settings to social_profiles
ALTER TABLE social_profiles 
ADD COLUMN IF NOT EXISTS video_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS avatar_id TEXT,
ADD COLUMN IF NOT EXISTS voice_id TEXT,
ADD COLUMN IF NOT EXISTS avatar_style TEXT DEFAULT 'professional',
ADD COLUMN IF NOT EXISTS avatar_gender TEXT DEFAULT 'male';

COMMENT ON COLUMN social_profiles.video_enabled IS 'Se a IA deve preferir gerar vídeos com avatar em vez de imagens estáticas';
COMMENT ON COLUMN social_profiles.avatar_id IS 'ID do avatar escolhido no provedor (HeyGen, D-ID, etc)';
COMMENT ON COLUMN social_profiles.voice_id IS 'ID da voz escolhida para o avatar';
