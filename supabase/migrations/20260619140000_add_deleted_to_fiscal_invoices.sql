-- Adiciona a coluna deleted para exclusão lógica das notas fiscais
ALTER TABLE public.fiscal_invoices
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE NOT NULL;
