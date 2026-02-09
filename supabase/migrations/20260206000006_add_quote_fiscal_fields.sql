-- Adicionar campos fiscais para Orçamentos/Pedidos
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS nfe_id VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS nfe_status VARCHAR(20);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS nfe_pdf_url TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS nfe_xml_url TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS nfe_error TEXT;

-- Comentários para documentação
COMMENT ON COLUMN quotes.nfe_id IS 'ID da nota no PlugNotas / TecnoSpeed';
COMMENT ON COLUMN quotes.nfe_status IS 'Status da nota (processando, autorizado, erro)';
