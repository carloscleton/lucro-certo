-- Adicionar relacionamento de Nota Fiscal em loyalty_charges 🔄
ALTER TABLE public.loyalty_charges 
ADD COLUMN IF NOT EXISTS fiscal_invoice_id UUID REFERENCES public.fiscal_invoices(id) ON DELETE SET NULL;

-- Indexar a coluna para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_loyalty_charges_fiscal_invoice ON public.loyalty_charges(fiscal_invoice_id);

-- Comentários explicativos
COMMENT ON COLUMN public.loyalty_charges.fiscal_invoice_id IS 'ID da Nota Fiscal associada a esta cobrança de fidelidade.';
