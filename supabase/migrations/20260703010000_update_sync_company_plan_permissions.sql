-- Update sync_company_plan_permissions trigger function to support loyalty, banking and warranty modules
CREATE OR REPLACE FUNCTION public.sync_company_plan_permissions()
RETURNS TRIGGER AS $$
DECLARE
    plan_data JSONB;
    app_plans JSONB;
    modules_to_set JSONB;
    profile_mods JSONB;
BEGIN
    -- 1. Buscar os planos configurados no painel Master
    SELECT landing_plans INTO app_plans FROM public.app_settings WHERE id = 1;
    
    -- 2. Localizar o plano que corresponde ao nome selecionado
    SELECT p INTO plan_data 
    FROM jsonb_array_elements(app_plans) AS p 
    WHERE LOWER(p->>'name') = LOWER(NEW.subscription_plan);

    -- 3. Se o plano for encontrado, "libera" as permissões configuradas
    IF plan_data IS NOT NULL THEN
        modules_to_set := plan_data->'modules';
        profile_mods := plan_data->'profile_modules';

        -- Aplicar Módulos da Empresa (Booleans Diretos)
        NEW.fiscal_module_enabled := COALESCE((modules_to_set->>'fiscal_module_enabled')::boolean, NEW.fiscal_module_enabled);
        NEW.payments_module_enabled := COALESCE((modules_to_set->>'payments_module_enabled')::boolean, NEW.payments_module_enabled);
        NEW.crm_module_enabled := COALESCE((modules_to_set->>'crm_module_enabled')::boolean, NEW.crm_module_enabled);
        NEW.has_social_copilot := COALESCE((modules_to_set->>'has_social_copilot')::boolean, NEW.has_social_copilot);
        NEW.automations_module_enabled := COALESCE((modules_to_set->>'automations_module_enabled')::boolean, NEW.automations_module_enabled);
        NEW.has_lead_radar := COALESCE((modules_to_set->>'has_lead_radar')::boolean, NEW.has_lead_radar);
        NEW.loyalty_module_enabled := COALESCE((modules_to_set->>'loyalty_module_enabled')::boolean, NEW.loyalty_module_enabled);
        NEW.banking_module_enabled := COALESCE((modules_to_set->>'banking_module_enabled')::boolean, NEW.banking_module_enabled);
        NEW.warranty_module_enabled := COALESCE((modules_to_set->>'warranty_module_enabled')::boolean, NEW.warranty_module_enabled);

        -- Aplicar Acesso ao Sidebar (Menus do Perfil)
        NEW.settings := jsonb_set(
            COALESCE(NEW.settings, '{}'::jsonb),
            '{modules}',
            COALESCE(profile_mods, '{}'::jsonb)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
