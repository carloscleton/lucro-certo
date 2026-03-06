-- Migration: Add entity_type support (PF/PJ) to companies
-- Adds entity_type column to companies table

-- Add entity_type to companies (PF = Pessoa Física, PJ = Pessoa Jurídica)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'entity_type') THEN
    ALTER TABLE companies ADD COLUMN entity_type text NOT NULL DEFAULT 'PJ';
  END IF;
END $$;

-- Add CPF field (for PF clients). CNPJ is already there for PJ.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'cpf') THEN
    ALTER TABLE companies ADD COLUMN cpf text;
  END IF;
END $$;

-- Add allowed_entity_types configuration field
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'allowed_entity_types') THEN
    ALTER TABLE companies ADD COLUMN allowed_entity_types text[] NOT NULL DEFAULT ARRAY['PF', 'PJ'];
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN companies.entity_type IS 'PF = Pessoa Fisica, PJ = Pessoa Juridica';
COMMENT ON COLUMN companies.cpf IS 'CPF do titular quando entity_type = PF';
COMMENT ON COLUMN companies.allowed_entity_types IS 'Tipos de conta que esta empresa permite para seus sub-clientes';
