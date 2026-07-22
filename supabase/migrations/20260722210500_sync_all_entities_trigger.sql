-- Sync all existing companies and profiles when landing_plans settings are updated
CREATE OR REPLACE FUNCTION public.sync_all_entities_on_plan_update()
RETURNS TRIGGER AS $$
DECLARE
    plan_record RECORD;
    plan_name TEXT;
    modules_to_set JSONB;
    profile_mods_pf JSONB;
    settings_tabs_pf JSONB;
    profile_mods_pj JSONB;
    settings_tabs_pj JSONB;
BEGIN
    -- Only run if landing_plans has changed
    IF OLD.landing_plans IS DISTINCT FROM NEW.landing_plans THEN
        -- Loop through each plan in the new configuration
        FOR plan_record IN SELECT * FROM jsonb_array_elements(NEW.landing_plans) LOOP
            plan_name := plan_record.value->>'name';
            modules_to_set := plan_record.value->'modules';
            
            profile_mods_pf := COALESCE(plan_record.value->'profile_modules', '{}'::jsonb);
            settings_tabs_pf := COALESCE(plan_record.value->'settings_tabs', '{}'::jsonb);
            
            profile_mods_pj := COALESCE(plan_record.value->'pj_profile_modules', '{}'::jsonb);
            settings_tabs_pj := COALESCE(plan_record.value->'pj_settings_tabs', '{}'::jsonb);

            -- 1. Sync PJ Companies on this plan
            UPDATE public.companies
            SET 
                fiscal_module_enabled = COALESCE((modules_to_set->>'fiscal_module_enabled')::boolean, false),
                payments_module_enabled = COALESCE((modules_to_set->>'payments_module_enabled')::boolean, false),
                crm_module_enabled = COALESCE((modules_to_set->>'crm_module_enabled')::boolean, false),
                has_social_copilot = COALESCE((modules_to_set->>'has_social_copilot')::boolean, false),
                automations_module_enabled = COALESCE((modules_to_set->>'automations_module_enabled')::boolean, false),
                has_lead_radar = COALESCE((modules_to_set->>'has_lead_radar')::boolean, false),
                loyalty_module_enabled = COALESCE((modules_to_set->>'loyalty_module_enabled')::boolean, false),
                banking_module_enabled = COALESCE((modules_to_set->>'banking_module_enabled')::boolean, false),
                warranty_module_enabled = COALESCE((modules_to_set->>'warranty_module_enabled')::boolean, false),
                settings = jsonb_set(
                    jsonb_set(
                        COALESCE(settings, '{}'::jsonb),
                        '{modules}',
                        jsonb_build_object(
                            'dashboard', jsonb_build_object('admin', true, 'member', true),
                            'quotes', COALESCE(profile_mods_pj->'quotes', '{"admin": false, "member": false}'::jsonb),
                            'receivables', COALESCE(profile_mods_pj->'receivables', '{"admin": false, "member": false}'::jsonb),
                            'payables', COALESCE(profile_mods_pj->'payables', '{"admin": false, "member": false}'::jsonb),
                            'invoices', COALESCE(profile_mods_pj->'invoices', '{"admin": false, "member": false}'::jsonb),
                            'categories', COALESCE(profile_mods_pj->'categories', '{"admin": false, "member": false}'::jsonb),
                            'companies', COALESCE(profile_mods_pj->'companies', '{"admin": false, "member": false}'::jsonb),
                            'contacts', COALESCE(profile_mods_pj->'contacts', '{"admin": false, "member": false}'::jsonb),
                            'services', COALESCE(profile_mods_pj->'services', '{"admin": false, "member": false}'::jsonb),
                            'products', COALESCE(profile_mods_pj->'products', '{"admin": false, "member": false}'::jsonb),
                            'whatsapp', COALESCE(profile_mods_pj->'whatsapp', '{"admin": false, "member": false}'::jsonb),
                            'payments', COALESCE(profile_mods_pj->'payments', '{"admin": false, "member": false}'::jsonb),
                            'crm', COALESCE(profile_mods_pj->'crm', '{"admin": false, "member": false}'::jsonb),
                            'agenda', COALESCE(profile_mods_pj->'agenda', '{"admin": false, "member": false}'::jsonb),
                            'marketing', COALESCE(profile_mods_pj->'marketing', '{"admin": false, "member": false}'::jsonb),
                            'lead_radar', COALESCE(profile_mods_pj->'lead_radar', '{"admin": false, "member": false}'::jsonb),
                            'loyalty', COALESCE(profile_mods_pj->'loyalty', '{"admin": false, "member": false}'::jsonb),
                            'commissions', COALESCE(profile_mods_pj->'commissions', '{"admin": false, "member": false}'::jsonb),
                            'reports', COALESCE(profile_mods_pj->'reports', '{"admin": false, "member": false}'::jsonb),
                            'settings', jsonb_build_object('admin', true, 'member', false)
                        )
                    ),
                    '{settings_tabs}',
                    jsonb_build_object(
                        'quotes', COALESCE(settings_tabs_pj->'quotes', '{"admin": false, "member": false}'::jsonb),
                        'financial', COALESCE(settings_tabs_pj->'financial', '{"admin": false, "member": false}'::jsonb),
                        'team', COALESCE(settings_tabs_pj->'team', '{"admin": false, "member": false}'::jsonb),
                        'webhooks', COALESCE(settings_tabs_pj->'webhooks', '{"admin": false, "member": false}'::jsonb),
                        'whatsapp', COALESCE(settings_tabs_pj->'whatsapp', '{"admin": false, "member": false}'::jsonb),
                        'payments', COALESCE(settings_tabs_pj->'payments', '{"admin": false, "member": false}'::jsonb),
                        'banking', COALESCE(settings_tabs_pj->'banking', '{"admin": false, "member": false}'::jsonb),
                        'automations', COALESCE(settings_tabs_pj->'automations', '{"admin": false, "member": false}'::jsonb),
                        'fiscal', COALESCE(settings_tabs_pj->'fiscal', '{"admin": false, "member": false}'::jsonb),
                        'subscription', COALESCE(settings_tabs_pj->'subscription', '{"admin": false, "member": false}'::jsonb),
                        'platform', COALESCE(settings_tabs_pj->'platform', '{"admin": false, "member": false}'::jsonb)
                    )
                )
            WHERE entity_type = 'PJ' AND TRIM(LOWER(subscription_plan)) = TRIM(LOWER(plan_name));

            -- 2. Sync PF Companies on this plan
            UPDATE public.companies
            SET 
                fiscal_module_enabled = COALESCE((modules_to_set->>'fiscal_module_enabled')::boolean, false),
                payments_module_enabled = COALESCE((modules_to_set->>'payments_module_enabled')::boolean, false),
                crm_module_enabled = COALESCE((modules_to_set->>'crm_module_enabled')::boolean, false),
                has_social_copilot = COALESCE((modules_to_set->>'has_social_copilot')::boolean, false),
                automations_module_enabled = COALESCE((modules_to_set->>'automations_module_enabled')::boolean, false),
                has_lead_radar = COALESCE((modules_to_set->>'has_lead_radar')::boolean, false),
                loyalty_module_enabled = COALESCE((modules_to_set->>'loyalty_module_enabled')::boolean, false),
                banking_module_enabled = COALESCE((modules_to_set->>'banking_module_enabled')::boolean, false),
                warranty_module_enabled = COALESCE((modules_to_set->>'warranty_module_enabled')::boolean, false),
                settings = jsonb_set(
                    jsonb_set(
                        COALESCE(settings, '{}'::jsonb),
                        '{modules}',
                        jsonb_build_object(
                            'dashboard', jsonb_build_object('admin', true, 'member', true),
                            'quotes', COALESCE(profile_mods_pf->'quotes', '{"admin": false, "member": false}'::jsonb),
                            'receivables', COALESCE(profile_mods_pf->'receivables', '{"admin": false, "member": false}'::jsonb),
                            'payables', COALESCE(profile_mods_pf->'payables', '{"admin": false, "member": false}'::jsonb),
                            'invoices', COALESCE(profile_mods_pf->'invoices', '{"admin": false, "member": false}'::jsonb),
                            'categories', COALESCE(profile_mods_pf->'categories', '{"admin": false, "member": false}'::jsonb),
                            'companies', COALESCE(profile_mods_pf->'companies', '{"admin": false, "member": false}'::jsonb),
                            'contacts', COALESCE(profile_mods_pf->'contacts', '{"admin": false, "member": false}'::jsonb),
                            'services', COALESCE(profile_mods_pf->'services', '{"admin": false, "member": false}'::jsonb),
                            'products', COALESCE(profile_mods_pf->'products', '{"admin": false, "member": false}'::jsonb),
                            'whatsapp', COALESCE(profile_mods_pf->'whatsapp', '{"admin": false, "member": false}'::jsonb),
                            'payments', COALESCE(profile_mods_pf->'payments', '{"admin": false, "member": false}'::jsonb),
                            'crm', COALESCE(profile_mods_pf->'crm', '{"admin": false, "member": false}'::jsonb),
                            'agenda', COALESCE(profile_mods_pf->'agenda', '{"admin": false, "member": false}'::jsonb),
                            'marketing', COALESCE(profile_mods_pf->'marketing', '{"admin": false, "member": false}'::jsonb),
                            'lead_radar', COALESCE(profile_mods_pf->'lead_radar', '{"admin": false, "member": false}'::jsonb),
                            'loyalty', COALESCE(profile_mods_pf->'loyalty', '{"admin": false, "member": false}'::jsonb),
                            'commissions', COALESCE(profile_mods_pf->'commissions', '{"admin": false, "member": false}'::jsonb),
                            'reports', COALESCE(profile_mods_pf->'reports', '{"admin": false, "member": false}'::jsonb),
                            'settings', jsonb_build_object('admin', true, 'member', false)
                        )
                    ),
                    '{settings_tabs}',
                    jsonb_build_object(
                        'quotes', COALESCE(settings_tabs_pf->'quotes', '{"admin": false, "member": false}'::jsonb),
                        'financial', COALESCE(settings_tabs_pf->'financial', '{"admin": false, "member": false}'::jsonb),
                        'team', COALESCE(settings_tabs_pf->'team', '{"admin": false, "member": false}'::jsonb),
                        'webhooks', COALESCE(settings_tabs_pf->'webhooks', '{"admin": false, "member": false}'::jsonb),
                        'whatsapp', COALESCE(settings_tabs_pf->'whatsapp', '{"admin": false, "member": false}'::jsonb),
                        'payments', COALESCE(settings_tabs_pf->'payments', '{"admin": false, "member": false}'::jsonb),
                        'banking', COALESCE(settings_tabs_pf->'banking', '{"admin": false, "member": false}'::jsonb),
                        'automations', COALESCE(settings_tabs_pf->'automations', '{"admin": false, "member": false}'::jsonb),
                        'fiscal', COALESCE(settings_tabs_pf->'fiscal', '{"admin": false, "member": false}'::jsonb),
                        'subscription', COALESCE(settings_tabs_pf->'subscription', '{"admin": false, "member": false}'::jsonb),
                        'platform', COALESCE(settings_tabs_pf->'platform', '{"admin": false, "member": false}'::jsonb)
                    )
                )
            WHERE entity_type = 'PF' AND TRIM(LOWER(subscription_plan)) = TRIM(LOWER(plan_name));

            -- 3. Sync existing profiles (personal settings) whose associated company is on this plan
            UPDATE public.profiles p
            SET settings = COALESCE(p.settings, '{}'::jsonb) || jsonb_build_object(
                'subscription_plan', plan_name,
                'modules', jsonb_build_object(
                    'dashboard', jsonb_build_object('admin', true, 'member', true),
                    'quotes', COALESCE(profile_mods_pf->'quotes', '{"admin": false, "member": false}'::jsonb),
                    'receivables', COALESCE(profile_mods_pf->'receivables', '{"admin": false, "member": false}'::jsonb),
                    'payables', COALESCE(profile_mods_pf->'payables', '{"admin": false, "member": false}'::jsonb),
                    'invoices', COALESCE(profile_mods_pf->'invoices', '{"admin": false, "member": false}'::jsonb),
                    'categories', COALESCE(profile_mods_pf->'categories', '{"admin": false, "member": false}'::jsonb),
                    'companies', COALESCE(profile_mods_pf->'companies', '{"admin": false, "member": false}'::jsonb),
                    'contacts', COALESCE(profile_mods_pf->'contacts', '{"admin": false, "member": false}'::jsonb),
                    'services', COALESCE(profile_mods_pf->'services', '{"admin": false, "member": false}'::jsonb),
                    'products', COALESCE(profile_mods_pf->'products', '{"admin": false, "member": false}'::jsonb),
                    'whatsapp', COALESCE(profile_mods_pf->'whatsapp', '{"admin": false, "member": false}'::jsonb),
                    'payments', COALESCE(profile_mods_pf->'payments', '{"admin": false, "member": false}'::jsonb),
                    'crm', COALESCE(profile_mods_pf->'crm', '{"admin": false, "member": false}'::jsonb),
                    'agenda', COALESCE(profile_mods_pf->'agenda', '{"admin": false, "member": false}'::jsonb),
                    'marketing', COALESCE(profile_mods_pf->'marketing', '{"admin": false, "member": false}'::jsonb),
                    'lead_radar', COALESCE(profile_mods_pf->'lead_radar', '{"admin": false, "member": false}'::jsonb),
                    'loyalty', COALESCE(profile_mods_pf->'loyalty', '{"admin": false, "member": false}'::jsonb),
                    'commissions', COALESCE(profile_mods_pf->'commissions', '{"admin": false, "member": false}'::jsonb),
                    'reports', COALESCE(profile_mods_pf->'reports', '{"admin": false, "member": false}'::jsonb),
                    'settings', jsonb_build_object('admin', true, 'member', false)
                ),
                'settings_tabs', jsonb_build_object(
                    'quotes', COALESCE(settings_tabs_pf->'quotes', '{"admin": false, "member": false}'::jsonb),
                    'financial', COALESCE(settings_tabs_pf->'financial', '{"admin": false, "member": false}'::jsonb),
                    'team', COALESCE(settings_tabs_pf->'team', '{"admin": false, "member": false}'::jsonb),
                    'webhooks', COALESCE(settings_tabs_pf->'webhooks', '{"admin": false, "member": false}'::jsonb),
                    'whatsapp', COALESCE(settings_tabs_pf->'whatsapp', '{"admin": false, "member": false}'::jsonb),
                    'payments', COALESCE(settings_tabs_pf->'payments', '{"admin": false, "member": false}'::jsonb),
                    'banking', COALESCE(settings_tabs_pf->'banking', '{"admin": false, "member": false}'::jsonb),
                    'automations', COALESCE(settings_tabs_pf->'automations', '{"admin": false, "member": false}'::jsonb),
                    'fiscal', COALESCE(settings_tabs_pf->'fiscal', '{"admin": false, "member": false}'::jsonb),
                    'subscription', COALESCE(settings_tabs_pf->'subscription', '{"admin": false, "member": false}'::jsonb),
                    'platform', COALESCE(settings_tabs_pf->'platform', '{"admin": false, "member": false}'::jsonb)
                )
            )
            FROM public.companies c
            WHERE c.user_id = p.id AND TRIM(LOWER(c.subscription_plan)) = TRIM(LOWER(plan_name));
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_sync_all_entities_on_plan_update ON public.app_settings;
CREATE TRIGGER trg_sync_all_entities_on_plan_update
    AFTER UPDATE OF landing_plans
    ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_all_entities_on_plan_update();
