-- 1. Recreate the trigger function with the new paths
CREATE OR REPLACE FUNCTION extract_fiscal_metadata()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payload IS NOT NULL THEN
        NEW.access_key := COALESCE(
            NEW.payload->'retorno'->>'chaveAcesso',
            NEW.payload->>'chaveAcesso',
            NEW.payload->'retorno'->>'codigoVerificacao',
            NEW.payload->>'codigoVerificacao',
            NEW.access_key
        );

        NEW.invoice_number := COALESCE(
            NEW.payload->'retorno'->>'numeroNfse',
            NEW.payload->>'numeroNfse',
            NEW.payload->>'numeroNfe',
            NEW.payload->'retorno'->>'numero',
            NEW.payload->>'numero',
            NEW.invoice_number
        );

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

        NEW.plugnotas_id := COALESCE(
            NEW.payload->'retorno'->>'id',
            NEW.payload->'retorno'->'data'->>'id',
            NEW.payload->>'id',
            NEW.plugnotas_id
        );

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

-- 2. Backfill existing records that have NULL dps_number or dps_serie
UPDATE fiscal_invoices
SET 
  dps_number = COALESCE(
      payload->'retorno'->'dps'->>'numero',
      payload->'dps'->>'numero',
      payload->'nacional'->'dps'->>'numero',
      payload->'DPS'->'infDPS'->>'nDPS',
      payload->>'nDPS',
      payload->'retorno'->'rps'->>'numero',
      payload->'rps'->>'numero'
  ),
  dps_serie = COALESCE(
      payload->'retorno'->'dps'->>'serie',
      payload->'dps'->>'serie',
      payload->'nacional'->'dps'->>'serie',
      payload->'DPS'->'infDPS'->>'serie',
      payload->>'serie',
      payload->'retorno'->'rps'->>'serie',
      payload->'rps'->>'serie'
  )
WHERE dps_number IS NULL OR dps_serie IS NULL;
