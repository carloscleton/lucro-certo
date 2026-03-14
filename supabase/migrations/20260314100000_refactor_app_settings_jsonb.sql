-- Refactor app_settings to use JSONB for platform billing config 🚀
-- This allows storing multiple keys (sandbox and production) simultaneously.

-- 1. Add the new JSONB column
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS platform_billing_config JSONB DEFAULT '{}'::jsonb;

-- 2. Migrate existing data if any (Optional but good practice)
UPDATE public.app_settings
SET platform_billing_config = jsonb_build_object(
    'asaas', jsonb_build_object(
        'production', jsonb_build_object(
            'api_key', platform_asaas_api_key,
            'wallet_id', platform_asaas_wallet_id
        ),
        'sandbox', jsonb_build_object(
            'api_key', CASE WHEN platform_billing_sandbox THEN platform_asaas_api_key ELSE NULL END,
            'wallet_id', CASE WHEN platform_billing_sandbox THEN platform_asaas_wallet_id ELSE NULL END
        )
    ),
    'stripe', jsonb_build_object(
        'production', jsonb_build_object(
            'secret_key', platform_stripe_api_key,
            'publishable_key', platform_stripe_publishable_key
        ),
        'sandbox', jsonb_build_object(
            'secret_key', CASE WHEN platform_billing_sandbox THEN platform_stripe_api_key ELSE NULL END,
            'publishable_key', CASE WHEN platform_billing_sandbox THEN platform_stripe_publishable_key ELSE NULL END
        )
    ),
    'mercadopago', jsonb_build_object(
        'production', jsonb_build_object(
            'access_token', platform_mercadopago_api_key,
            'public_key', platform_mercadopago_public_key
        ),
        'sandbox', jsonb_build_object(
            'access_token', CASE WHEN platform_billing_sandbox THEN platform_mercadopago_api_key ELSE NULL END,
            'public_key', CASE WHEN platform_billing_sandbox THEN platform_mercadopago_public_key ELSE NULL END
        )
    )
)
WHERE id = 1;

-- 3. We keep the old columns for a short period or drop them if we are confident
-- For this refactor, let's keep them commented or just leave them as they don't hurt, 
-- but we will stop using them in the code.
-- ALTER TABLE public.app_settings DROP COLUMN platform_asaas_api_key;
-- ALTER TABLE public.app_settings DROP COLUMN platform_asaas_wallet_id;
-- ... etc
