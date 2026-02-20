-- Adicionar suporte a lançamentos recorrentes e valores variáveis 🔄
-- Este script adiciona as colunas necessárias para gerenciar grupos de recorrência e identificar valores estimados.

-- 1. Adicionar colunas na tabela transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS is_variable_amount BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,
ADD COLUMN IF NOT EXISTS installment_number INTEGER;

-- 2. Indexar recurrence_group_id para busca rápida
CREATE INDEX IF NOT EXISTS idx_transactions_recurrence_group ON public.transactions(recurrence_group_id);

-- 3. Comentários para documentação
COMMENT ON COLUMN public.transactions.is_variable_amount IS 'Indica se o valor é variável (ex: conta de luz) e pode mudar em parcelas futuras.';
COMMENT ON COLUMN public.transactions.recurrence_group_id IS 'ID que vincula todas as parcelas de uma mesma série recorrente.';
COMMENT ON COLUMN public.transactions.installment_number IS 'Número da parcela dentro da série (1, 2, 3...)';
