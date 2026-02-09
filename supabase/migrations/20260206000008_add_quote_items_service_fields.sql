-- Adicionar campos de serviço para Itens de Orçamento (NFS-e)
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS codigo_servico_municipal VARCHAR(20);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS item_lista_servico VARCHAR(10);

-- Comentários para documentação
COMMENT ON COLUMN quote_items.codigo_servico_municipal IS 'Código do serviço na prefeitura no momento do orçamento';
COMMENT ON COLUMN quote_items.item_lista_servico IS 'Item da LC 116/2003 no momento do orçamento';
