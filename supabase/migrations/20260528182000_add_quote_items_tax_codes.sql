-- Adicionar colunas de tributação municipal e nacional em quote_items
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS codigo_tributacao VARCHAR(20);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS codigo_tributacao_nacional VARCHAR(9);

-- Comentários explicativos
COMMENT ON COLUMN quote_items.codigo_tributacao IS 'Código de tributação municipal do item no momento do orçamento';
COMMENT ON COLUMN quote_items.codigo_tributacao_nacional IS 'Código de tributação nacional do item no momento do orçamento';
