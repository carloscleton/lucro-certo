-- Add last_verified_at to payment gateways
ALTER TABLE public.company_payment_gateways 
ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN public.company_payment_gateways.last_verified_at IS 'Data/hora da última verificação bem-sucedida das credenciais';
