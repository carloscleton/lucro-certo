-- Add address fields to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS street VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS number VARCHAR(20);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS complement VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state VARCHAR(2);

COMMENT ON COLUMN companies.zip_code IS 'Código de Endereçamento Postal (CEP)';
COMMENT ON COLUMN companies.street IS 'Logradouro/Rua';
COMMENT ON COLUMN companies.number IS 'Número do endereço';
COMMENT ON COLUMN companies.complement IS 'Complemento do endereço';
COMMENT ON COLUMN companies.neighborhood IS 'Bairro';
COMMENT ON COLUMN companies.city IS 'Cidade';
COMMENT ON COLUMN companies.state IS 'Unidade Federativa (Sigla)';
