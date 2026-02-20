-- ============================================================
-- SCRIPT: Remover Role "Owner" - Substituir por "Admin"
-- Execute este script no Supabase Dashboard
-- ============================================================

-- PASSO 1: Atualizar usuários com role 'owner' para 'admin' (EXCETO o administrador da plataforma)
UPDATE public.company_members
SET role = 'admin'
WHERE role = 'owner'
AND user_id NOT IN (
    SELECT id FROM public.profiles WHERE email = 'carloscleton.nat@gmail.com'
);

-- PASSO 2: Garantir que o administrador da plataforma tenha a role 'owner'
UPDATE public.company_members
SET role = 'owner'
WHERE user_id IN (
    SELECT id FROM public.profiles WHERE email = 'carloscleton.nat@gmail.com'
);

-- PASSO 3: Verificar resultado
SELECT 
    role,
    COUNT(*) as total
FROM public.company_members
GROUP BY role
ORDER BY role;

-- PASSO 4: Verificar se ainda existem 'owner' não autorizados
SELECT 
    cm.id,
    cm.role,
    p.full_name,
    p.email,
    c.trade_name
FROM public.company_members cm
JOIN public.profiles p ON p.id = cm.user_id
JOIN public.companies c ON c.id = cm.company_id
WHERE cm.role = 'owner'
AND p.email != 'carloscleton.nat@gmail.com';

-- Resultado esperado: Apenas o e-mail carloscleton.nat@gmail.com deve aparecer como owner.
