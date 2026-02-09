-- Adiciona o campo de ambiente (Sandbox/Produção) nos gateways de pagamento
ALTER TABLE public.company_payment_gateways ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.company_payment_gateways.is_sandbox IS 'Define se o gateway está operando em ambiente de teste (Sandbox) ou Produção';
