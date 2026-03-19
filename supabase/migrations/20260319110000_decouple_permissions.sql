-- REFATORAÇÃO DE SETTINGS PADRÃO (SEGMENTAÇÃO INDEPENDENTE)
-- Este script permite que o sistema busque padrões diferentes para Sidebar (Usuário) e Módulos (Empresa)

CREATE OR REPLACE FUNCTION public.get_default_user_settings(
    is_pj_input BOOLEAN DEFAULT false,
    target_type_input TEXT DEFAULT 'profile' -- 'profile' ou 'company'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plans JSONB;
    v_target JSONB;
    v_search_term TEXT;
    v_defaults JSONB;
BEGIN
    -- 1. Buscar planos salvos no app_settings
    SELECT landing_plans INTO v_plans FROM public.app_settings WHERE id = 1;
    
    -- 2. Definir termo de busca baseado no tipo de conta
    v_search_term := CASE WHEN is_pj_input THEN '%Profissional%' ELSE '%Essencial%' END;

    -- 3. Tentar encontrar o plano correspondente
    SELECT p INTO v_target 
    FROM jsonb_array_elements(v_plans) AS p 
    WHERE (p->>'name') ILIKE v_search_term 
    LIMIT 1;

    -- 4. Se não encontrar plano, usar fallback fixo de segurança
    IF v_target IS NULL THEN
        IF target_type_input = 'profile' THEN
            RETURN '{
                "modules": {
                    "dashboard": {"admin": true, "member": true},
                    "receivables": {"admin": true, "member": true},
                    "payables": {"admin": true, "member": true},
                    "categories": {"admin": true, "member": true},
                    "reports": {"admin": true, "member": true},
                    "settings": {"admin": true, "member": false}
                }
            }'::jsonb;
        ELSE
            RETURN '{
                "modules": {
                    "fiscal_module_enabled": true,
                    "automations_module_enabled": true
                }
            }'::jsonb;
        END IF;
    END IF;

    -- 5. Retornar os módulos específicos baseados no target_type
    IF target_type_input = 'profile' THEN
        -- Retorna profile_modules (Sidebar) envolto na chave "modules" para compatibilidade com o frontend
        RETURN jsonb_build_object('modules', COALESCE(v_target->'profile_modules', v_target->'modules'));
    ELSE
        -- Retorna modules (Funções da Empresa)
        RETURN jsonb_build_object('modules', v_target->'modules');
    END IF;
END;
$$;

-- ATUALIZAÇÃO DO TRIGGER DE NOVOS PERFIS
CREATE OR REPLACE FUNCTION public.on_profile_created_set_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_pj BOOLEAN;
BEGIN
    -- Detectar se é PJ pelo tamanho do documento
    is_pj := (NEW.document IS NOT NULL AND length(NEW.document) >= 14);
    
    -- Aplicar configurações de PERFIL (Sidebar)
    NEW.settings := public.get_default_user_settings(is_pj, 'profile');
    
    RETURN NEW;
END;
$$;

-- OBS: O RPC create_company já faz o tratamento da empresa, mas o Trigger garante o Perfil.
