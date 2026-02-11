-- ============================================================
-- SCRIPT DE CORREÇÃO DE PERMISSÕES - PRODUÇÃO
-- Execute este script no Supabase Dashboard (SQL Editor)
-- URL: https://supabase.com/dashboard/project/oncddbarrtxalsmzravk/sql
-- ============================================================

-- PASSO 1: Verificar estado atual (ANTES da correção)
SELECT 
    id,
    trade_name,
    CASE 
        WHEN settings IS NULL THEN 'settings é NULL'
        WHEN settings->'modules' IS NULL THEN 'modules não existe'
        WHEN settings->'settings_tabs' IS NULL THEN 'settings_tabs não existe'
        ELSE 'OK - tem matriz completa'
    END as status,
    settings
FROM public.companies
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- PASSO 2: APLICAR CORREÇÃO
-- ============================================================

UPDATE public.companies
SET settings = jsonb_build_object(
    -- Preservar configurações existentes
    'member_can_delete', COALESCE((settings->>'member_can_delete')::boolean, false),
    'commission_rate', COALESCE((settings->>'commission_rate')::numeric, 0),
    'monthly_fee', COALESCE((settings->>'monthly_fee')::numeric, 0),
    'annual_fee', COALESCE((settings->>'annual_fee')::numeric, 0),
    
    -- Adicionar ou preservar matriz de módulos
    'modules', COALESCE(
        settings->'modules',
        jsonb_build_object(
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
        )
    ),
    
    -- Adicionar ou preservar matriz de abas de configuração
    'settings_tabs', COALESCE(
        settings->'settings_tabs',
        jsonb_build_object(
            'quotes', jsonb_build_object('admin', true, 'member', false),
            'financial', jsonb_build_object('admin', true, 'member', false),
            'team', jsonb_build_object('admin', true, 'member', false),
            'webhooks', jsonb_build_object('admin', true, 'member', false),
            'permissions', jsonb_build_object('admin', false, 'member', false),
            'whatsapp', jsonb_build_object('admin', true, 'member', false),
            'payments', jsonb_build_object('admin', true, 'member', false)
        )
    )
)
WHERE settings IS NULL 
   OR settings->'modules' IS NULL 
   OR settings->'settings_tabs' IS NULL;

-- ============================================================
-- PASSO 3: Verificar resultado (DEPOIS da correção)
-- ============================================================

SELECT 
    COUNT(*) as total_empresas,
    COUNT(CASE WHEN settings->'modules' IS NOT NULL THEN 1 END) as com_modulos,
    COUNT(CASE WHEN settings->'settings_tabs' IS NOT NULL THEN 1 END) as com_abas
FROM public.companies;

-- ============================================================
-- PASSO 4: Inspecionar uma empresa específica
-- ============================================================

SELECT 
    id,
    trade_name,
    jsonb_pretty(settings) as settings_formatado
FROM public.companies
ORDER BY created_at DESC
LIMIT 1;
