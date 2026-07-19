-- 1. Adicionar coluna service_id para referenciar o catálogo de serviços
ALTER TABLE public.loyalty_subscriptions ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- 2. Adicionar comentário explicativo na coluna
COMMENT ON COLUMN public.loyalty_subscriptions.service_id IS 'ID do Serviço do catálogo associado a esta recorrência (como alternativa a plano ou valor personalizado).';
