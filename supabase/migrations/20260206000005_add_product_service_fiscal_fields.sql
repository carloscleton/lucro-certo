-- Adicionar campos fiscais para Produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm VARCHAR(8);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cest VARCHAR(7);
ALTER TABLE products ADD COLUMN IF NOT EXISTS origem INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unidade_medida VARCHAR(6) DEFAULT 'UN';
ALTER TABLE products ADD COLUMN IF NOT EXISTS preco_custo DECIMAL(10,2) DEFAULT 0;

-- Adicionar campos fiscais para Serviços
ALTER TABLE services ADD COLUMN IF NOT EXISTS codigo_servico_municipal VARCHAR(20);
ALTER TABLE services ADD COLUMN IF NOT EXISTS item_lista_servico VARCHAR(10);
ALTER TABLE services ADD COLUMN IF NOT EXISTS unidade_medida VARCHAR(6) DEFAULT 'UN';

-- Comentários para documentação
COMMENT ON COLUMN products.ncm IS 'Nomenclatura Comum do Mercosul';
COMMENT ON COLUMN products.cest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN products.origem IS 'Origem da mercadoria (0-Nacional, 1-Estrangeira, etc)';
COMMENT ON COLUMN services.codigo_servico_municipal IS 'Código do serviço na prefeitura';
COMMENT ON COLUMN services.item_lista_servico IS 'Item da LC 116/2003';
