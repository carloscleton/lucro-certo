-- Migração para suporte a lucratividade de orçamentos
-- Adiciona vínculo de transações (despesas/receitas) a orçamentos (quotes)

-- 1. Coluna de vínculo
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL;

-- 2. Índice de performance
CREATE INDEX IF NOT EXISTS idx_transactions_quote_id ON public.transactions(quote_id);

-- 3. Garantia de deal_id (para CRM)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL;
