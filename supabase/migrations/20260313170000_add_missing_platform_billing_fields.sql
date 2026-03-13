-- Add missing platform billing fields to app_settings 💰
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS platform_stripe_publishable_key TEXT,
ADD COLUMN IF NOT EXISTS platform_mercadopago_public_key TEXT,
ADD COLUMN IF NOT EXISTS platform_billing_sandbox BOOLEAN DEFAULT true;

-- Update comments
COMMENT ON COLUMN public.app_settings.platform_stripe_publishable_key IS 'Public key for Stripe platform billing';
COMMENT ON COLUMN public.app_settings.platform_mercadopago_public_key IS 'Public key for Mercado Pago platform billing';
COMMENT ON COLUMN public.app_settings.platform_billing_sandbox IS 'Whether to use sandbox mode for platform-wide billing';
