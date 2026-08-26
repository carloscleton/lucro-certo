-- Adicionar colunas para detalhamento de valores pagos em atraso (Original vs Pago com Juros)
ALTER TABLE public.company_charges 
ADD COLUMN IF NOT EXISTS paid_amount numeric(10, 2) null,
ADD COLUMN IF NOT EXISTS interest_amount numeric(10, 2) null;
