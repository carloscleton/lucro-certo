-- 1. Permitir que plan_id seja nulo (para assinaturas com valor avulso/customizado)
ALTER TABLE public.loyalty_subscriptions ALTER COLUMN plan_id DROP NOT NULL;

-- 2. Adicionar coluna custom_price para guardar o valor customizado da recorrência
ALTER TABLE public.loyalty_subscriptions ADD COLUMN IF NOT EXISTS custom_price DECIMAL(12,2);

-- 3. Adicionar comentário explicativo na coluna
COMMENT ON COLUMN public.loyalty_subscriptions.custom_price IS 'Valor recorrente personalizado negociado com o cliente, caso não use plano fixo.';
