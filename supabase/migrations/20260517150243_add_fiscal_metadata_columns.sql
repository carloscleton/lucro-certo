-- Adiciona colunas para metadados fiscais extraídos do payload JSON
ALTER TABLE fiscal_invoices
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS dps_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS dps_serie VARCHAR(50),
ADD COLUMN IF NOT EXISTS access_key VARCHAR(100),
ADD COLUMN IF NOT EXISTS plugnotas_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS protocol VARCHAR(100);

-- Função para extrair dados do payload e preencher as colunas automaticamente
CREATE OR REPLACE FUNCTION extract_fiscal_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Only do this if payload is not null
    IF NEW.payload IS NOT NULL THEN
        -- Access Key (Chave de Acesso) ou Codigo de Verificacao
        NEW.access_key := COALESCE(
            NEW.payload->'retorno'->>'chaveAcesso',
            NEW.payload->>'chaveAcesso',
            NEW.payload->'retorno'->>'codigoVerificacao',
            NEW.payload->>'codigoVerificacao',
            NEW.access_key
        );

        -- Invoice Number (numeroNfse or similar)
        NEW.invoice_number := COALESCE(
            NEW.payload->'retorno'->>'numeroNfse',
            NEW.payload->>'numeroNfse',
            NEW.payload->>'numeroNfe',
            NEW.payload->'retorno'->>'numero',
            NEW.payload->>'numero',
            NEW.invoice_number
        );

        -- DPS/RPS Number
        NEW.dps_number := COALESCE(
            NEW.payload->'retorno'->'dps'->>'numero',
            NEW.payload->'dps'->>'numero',
            NEW.payload->'nacional'->'dps'->>'numero',
            NEW.payload->'DPS'->'infDPS'->>'nDPS',
            NEW.payload->>'nDPS',
            NEW.payload->'retorno'->'rps'->>'numero',
            NEW.payload->'rps'->>'numero',
            NEW.dps_number
        );

        -- DPS/RPS Serie
        NEW.dps_serie := COALESCE(
            NEW.payload->'retorno'->'dps'->>'serie',
            NEW.payload->'dps'->>'serie',
            NEW.payload->'nacional'->'dps'->>'serie',
            NEW.payload->'DPS'->'infDPS'->>'serie',
            NEW.payload->>'serie',
            NEW.payload->'retorno'->'rps'->>'serie',
            NEW.payload->'rps'->>'serie',
            NEW.dps_serie
        );

        -- Plugnotas ID
        NEW.plugnotas_id := COALESCE(
            NEW.payload->'retorno'->>'id',
            NEW.payload->'retorno'->'data'->>'id',
            NEW.payload->>'id',
            NEW.plugnotas_id
        );

        -- Protocolo
        NEW.protocol := COALESCE(
            NEW.payload->'retorno'->>'protocol',
            NEW.payload->'retorno'->>'protocolo',
            NEW.payload->>'protocol',
            NEW.protocol
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para executar a extração no INSERT ou UPDATE
DROP TRIGGER IF EXISTS update_fiscal_metadata ON fiscal_invoices;
CREATE TRIGGER update_fiscal_metadata
BEFORE INSERT OR UPDATE ON fiscal_invoices
FOR EACH ROW EXECUTE FUNCTION extract_fiscal_metadata();

-- Executa um update fake em todas as notas fiscais para preencher as novas colunas
-- usando os dados já existentes no JSON (retroativo)
UPDATE fiscal_invoices SET updated_at = NOW();
