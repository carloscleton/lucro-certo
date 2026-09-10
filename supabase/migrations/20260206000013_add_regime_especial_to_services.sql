-- Adicionar coluna regime_especial_tributacao na tabela services
ALTER TABLE services ADD COLUMN IF NOT EXISTS regime_especial_tributacao VARCHAR(10);

-- Comentário da coluna
COMMENT ON COLUMN services.regime_especial_tributacao IS 'Regime Especial de Tributação (0-Sem Regime Especial, 4-Cooperativa, etc)';
