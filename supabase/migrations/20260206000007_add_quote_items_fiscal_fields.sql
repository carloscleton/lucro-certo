-- Adicionar campos fiscais para Itens de Orçamento
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS ncm VARCHAR(8);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS cest VARCHAR(7);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS origem INTEGER DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN quote_items.ncm IS 'Nomenclatura Comum do Mercosul do item no momento do orçamento';
COMMENT ON COLUMN quote_items.cest IS 'CEST do item no momento do orçamento';
COMMENT ON COLUMN quote_items.origem IS 'Origem da mercadoria do item no momento do orçamento';
