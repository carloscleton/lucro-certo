-- Redeclare function to strictly sync plan permissions and default unchecked modules/tabs to false
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
    WHERE TRIM(LOWER(p->>'name')) = TRIM(LOWER(NEW.subscription_plan));

    -- 3. Se o plano for encontrado, "libera" as permissões configuradas
    IF plan_data IS NOT NULL THEN
        modules_to_set := plan_data->'modules';
        profile_mods := plan_data->'profile_modules';

        -- Aplicar Módulos da Empresa (Booleans Diretos)
        NEW.fiscal_module_enabled := COALESCE((modules_to_set->>'fiscal_module_enabled')::boolean, false);
        NEW.payments_module_enabled := COALESCE((modules_to_set->>'payments_module_enabled')::boolean, false);
        NEW.crm_module_enabled := COALESCE((modules_to_set->>'crm_module_enabled')::boolean, false);
        NEW.has_social_copilot := COALESCE((modules_to_set->>'has_social_copilot')::boolean, false);
        NEW.automations_module_enabled := COALESCE((modules_to_set->>'automations_module_enabled')::boolean, false);
        NEW.has_lead_radar := COALESCE((modules_to_set->>'has_lead_radar')::boolean, false);
        NEW.loyalty_module_enabled := COALESCE((modules_to_set->>'loyalty_module_enabled')::boolean, false);
        NEW.banking_module_enabled := COALESCE((modules_to_set->>'banking_module_enabled')::boolean, false);
        NEW.warranty_module_enabled := COALESCE((modules_to_set->>'warranty_module_enabled')::boolean, false);

        -- Aplicar Acesso ao Sidebar (Menus do Perfil)
        NEW.settings := jsonb_set(
            COALESCE(NEW.settings, '{}'::jsonb),
            '{modules}',
            jsonb_build_object(
                'dashboard', jsonb_build_object('admin', true, 'member', true),
                'quotes', COALESCE(profile_mods->'quotes', '{"admin": false, "member": false}'::jsonb),
                'receivables', COALESCE(profile_mods->'receivables', '{"admin": false, "member": false}'::jsonb),
                'payables', COALESCE(profile_mods->'payables', '{"admin": false, "member": false}'::jsonb),
                'invoices', COALESCE(profile_mods->'invoices', '{"admin": false, "member": false}'::jsonb),
                'categories', COALESCE(profile_mods->'categories', '{"admin": false, "member": false}'::jsonb),
                'companies', COALESCE(profile_mods->'companies', '{"admin": false, "member": false}'::jsonb),
                'contacts', COALESCE(profile_mods->'contacts', '{"admin": false, "member": false}'::jsonb),
                'services', COALESCE(profile_mods->'services', '{"admin": false, "member": false}'::jsonb),
                'products', COALESCE(profile_mods->'products', '{"admin": false, "member": false}'::jsonb),
                'whatsapp', COALESCE(profile_mods->'whatsapp', '{"admin": false, "member": false}'::jsonb),
                'payments', COALESCE(profile_mods->'payments', '{"admin": false, "member": false}'::jsonb),
                'crm', COALESCE(profile_mods->'crm', '{"admin": false, "member": false}'::jsonb),
                'agenda', COALESCE(profile_mods->'agenda', '{"admin": false, "member": false}'::jsonb),
                'marketing', COALESCE(profile_mods->'marketing', '{"admin": false, "member": false}'::jsonb),
                'lead_radar', COALESCE(profile_mods->'lead_radar', '{"admin": false, "member": false}'::jsonb),
                'loyalty', COALESCE(profile_mods->'loyalty', '{"admin": false, "member": false}'::jsonb),
                'commissions', COALESCE(profile_mods->'commissions', '{"admin": false, "member": false}'::jsonb),
                'reports', COALESCE(profile_mods->'reports', '{"admin": false, "member": false}'::jsonb),
                'settings', jsonb_build_object('admin', true, 'member', false)
            )
        );

        -- Aplicar Abas de Configuração (settings_tabs)
        NEW.settings := jsonb_set(
            NEW.settings,
            '{settings_tabs}',
            jsonb_build_object(
                'quotes', COALESCE(plan_data->'settings_tabs'->'quotes', '{"admin": false, "member": false}'::jsonb),
                'financial', COALESCE(plan_data->'settings_tabs'->'financial', '{"admin": false, "member": false}'::jsonb),
                'team', COALESCE(plan_data->'settings_tabs'->'team', '{"admin": false, "member": false}'::jsonb),
                'webhooks', COALESCE(plan_data->'settings_tabs'->'webhooks', '{"admin": false, "member": false}'::jsonb),
                'whatsapp', COALESCE(plan_data->'settings_tabs'->'whatsapp', '{"admin": false, "member": false}'::jsonb),
                'payments', COALESCE(plan_data->'settings_tabs'->'payments', '{"admin": false, "member": false}'::jsonb),
                'banking', COALESCE(plan_data->'settings_tabs'->'banking', '{"admin": false, "member": false}'::jsonb),
                'automations', COALESCE(plan_data->'settings_tabs'->'automations', '{"admin": false, "member": false}'::jsonb),
                'fiscal', COALESCE(plan_data->'settings_tabs'->'fiscal', '{"admin": false, "member": false}'::jsonb),
                'subscription', COALESCE(plan_data->'settings_tabs'->'subscription', '{"admin": false, "member": false}'::jsonb),
                'platform', COALESCE(plan_data->'settings_tabs'->'platform', '{"admin": false, "member": false}'::jsonb)
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to ensure it runs correctly on updates
DROP TRIGGER IF EXISTS trg_sync_company_plan ON public.companies;
CREATE TRIGGER trg_sync_company_plan
    BEFORE INSERT OR UPDATE OF subscription_plan
    ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_company_plan_permissions();
