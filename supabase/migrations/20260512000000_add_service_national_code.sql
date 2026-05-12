-- Adicionar campo de Código de Tributação Nacional (9 dígitos) para Serviços
ALTER TABLE services ADD COLUMN IF NOT EXISTS codigo_tributacao_nacional VARCHAR(9);

-- Comentário para documentação
COMMENT ON COLUMN services.codigo_tributacao_nacional IS 'Código de Tributação Nacional (NFSe Nacional - 9 dígitos)';
