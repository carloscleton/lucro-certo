-- Adiciona o campo de ativação do módulo de pagamentos na tabela de empresas
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS payments_module_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.companies.payments_module_enabled IS 'Indica se o módulo de gateways de pagamento dinâmicos está ativo para esta empresa';
