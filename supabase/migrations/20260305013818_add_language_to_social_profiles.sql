-- Add language to social_profiles
ALTER TABLE social_profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt-BR';

COMMENT ON COLUMN social_profiles.language IS 'Idioma preferencial para geração de conteúdo (pt-BR, en-US, es-ES, etc)';
