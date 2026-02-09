-- Garante que a coluna de configurações exista na tebela de empresas
-- Se não existir, cria. Se existir, não faz nada mas previne erros.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'settings') THEN
        ALTER TABLE public.companies ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END;
$$;

-- Migração Forçada: Copia configurações pessoais para a empresa
-- Isso garante que o valor "5" que está na sua conta vá para a empresa
UPDATE public.companies c
SET settings = (
    SELECT jsonb_build_object(
        'quote_validity_days', us.quote_validity_days,
        'commission_rate', us.commission_rate,
        'service_commission_rate', us.service_commission_rate,
        'product_commission_rate', us.product_commission_rate
    )
    FROM public.user_settings us
    WHERE us.user_id = c.user_id
)
WHERE c.settings IS NULL OR c.settings = '{}'::jsonb;
