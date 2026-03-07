-- Adicionar coluna para armazenar o número total de repetições configurado
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS recurring_count INTEGER;

COMMENT ON COLUMN public.transactions.recurring_count IS 'Número total de repetições/parcelas configurado para esta recorrência.';
