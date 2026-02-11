-- ============================================================
-- SCRIPT: Remover Role "Owner" - Substituir por "Admin"
-- Execute este script no Supabase Dashboard
-- ============================================================

-- PASSO 1: Atualizar todos os usuários com role 'owner' para 'admin'
UPDATE public.company_members
SET role = 'admin'
WHERE role = 'owner';

-- PASSO 2: Verificar resultado
SELECT 
    role,
    COUNT(*) as total
FROM public.company_members
GROUP BY role
ORDER BY role;

-- PASSO 3: Verificar se ainda existem 'owner'
SELECT 
    cm.id,
    cm.role,
    p.full_name,
    p.email,
    c.trade_name
FROM public.company_members cm
JOIN public.profiles p ON p.id = cm.user_id
JOIN public.companies c ON c.id = cm.company_id
WHERE cm.role = 'owner';

-- Resultado esperado: 0 linhas (nenhum owner restante)
