-- SCRIPT: Permissões Padrão para Novos Usuários 🛡️

-- 1. Função para gerar o JSON de configurações padrão
-- Baseado em src/config/permissions.ts
CREATE OR REPLACE FUNCTION public.get_default_user_settings()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN jsonb_build_object(
        'modules', jsonb_build_object(
            'dashboard', jsonb_build_object('admin', true, 'member', true),
            'quotes', jsonb_build_object('admin', true, 'member', true),
            'receivables', jsonb_build_object('admin', true, 'member', true),
            'payables', jsonb_build_object('admin', true, 'member', true),
            'categories', jsonb_build_object('admin', true, 'member', true),
            'companies', jsonb_build_object('admin', true, 'member', true),
            'contacts', jsonb_build_object('admin', true, 'member', true),
            'services', jsonb_build_object('admin', true, 'member', true),
            'products', jsonb_build_object('admin', true, 'member', true),
            'commissions', jsonb_build_object('admin', true, 'member', false),
            'reports', jsonb_build_object('admin', true, 'member', false),
            'settings', jsonb_build_object('admin', true, 'member', false),
            'whatsapp', jsonb_build_object('admin', true, 'member', false),
            'payments', jsonb_build_object('admin', true, 'member', false)
        ),
        'settings_tabs', jsonb_build_object(
            'quotes', jsonb_build_object('admin', true, 'member', false),
            'financial', jsonb_build_object('admin', true, 'member', false),
            'team', jsonb_build_object('admin', true, 'member', false),
            'webhooks', jsonb_build_object('admin', true, 'member', false),
            'permissions', jsonb_build_object('admin', false, 'member', false),
            'whatsapp', jsonb_build_object('admin', true, 'member', false),
            'payments', jsonb_build_object('admin', true, 'member', false)
        ),
        'can_create_companies', true
    );
END;
$$;

-- 2. Trigger para aplicar defaults em novos perfis
CREATE OR REPLACE FUNCTION public.on_profile_created_set_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Se settings estiver nulo ou vazio, aplica o padrão
    IF NEW.settings IS NULL OR NEW.settings = '{}'::jsonb THEN
        NEW.settings := public.get_default_user_settings();
    END IF;
    
    -- Se max_companies não estiver definido, coloca 1
    IF NEW.max_companies IS NULL THEN
        NEW.max_companies := 1;
    END IF;

    RETURN NEW;
END;
$$;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS tr_set_default_user_permissions ON public.profiles;

-- Cria o trigger de INSERT
CREATE TRIGGER tr_set_default_user_permissions
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.on_profile_created_set_defaults();

-- 3. Atualiza usuários existentes que estão sem configurações
UPDATE public.profiles
SET 
  settings = public.get_default_user_settings(),
  max_companies = COALESCE(max_companies, 1)
WHERE settings IS NULL OR settings = '{}'::jsonb;
