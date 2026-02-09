-- Adicionar suporte ao Módulo Fiscal nas Empresas
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fiscal_module_enabled BOOLEAN DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tecnospeed_config JSONB DEFAULT '{}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN companies.fiscal_module_enabled IS 'Indica se o módulo fiscal da TecnoSpeed está ativo para a empresa';
COMMENT ON COLUMN companies.tecnospeed_config IS 'Configurações da TecnoSpeed (API Key, Certificado ID, Ambiente, etc)';
