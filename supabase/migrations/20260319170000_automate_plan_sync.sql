-- ⚙️ Automação de Liberação de Planos ⚙️
-- Sincroniza automaticamente os módulos e acessos da empresa com as configurações do plano selecionado

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
    
    -- 2. Localizar o plano que corresponde ao nome selecionado (ex: 'Essencial', 'Profissional + IA')
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

        -- Aplicar Acesso ao Sidebar (Menus do Perfil)
        -- Mesclamos as permissões de menu no campo 'settings' da empresa
        NEW.settings := jsonb_set(
            COALESCE(NEW.settings, '{}'::jsonb),
            '{modules}',
            COALESCE(profile_mods, '{}'::jsonb)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar a Trigger: Executa ANTES de salvar a empresa se o plano mudar
DROP TRIGGER IF EXISTS trg_sync_company_plan ON public.companies;
CREATE TRIGGER trg_sync_company_plan
    BEFORE INSERT OR UPDATE OF subscription_plan
    ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_company_plan_permissions();
