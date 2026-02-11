-- ============================================================
-- SCRIPT: Configurar Owner apenas para Platform Admin
-- Execute este script no Supabase Dashboard
-- ============================================================

-- PASSO 1: Converter todos os 'owner' para 'admin' (exceto carloscleton.nat@gmail.com)
UPDATE public.company_members cm
SET role = 'admin'
WHERE role = 'owner'
  AND cm.user_id != (
      SELECT id FROM public.profiles 
      WHERE email = 'carloscleton.nat@gmail.com'
  );

-- PASSO 2: Garantir que carloscleton.nat@gmail.com seja 'owner' em todas as suas empresas
UPDATE public.company_members cm
SET role = 'owner'
WHERE cm.user_id = (
    SELECT id FROM public.profiles 
    WHERE email = 'carloscleton.nat@gmail.com'
)
AND cm.role != 'owner';

-- PASSO 3: Verificar resultado
SELECT 
    p.email,
    cm.role,
    c.trade_name as empresa,
    cm.status
FROM public.company_members cm
JOIN public.profiles p ON p.id = cm.user_id
JOIN public.companies c ON c.id = cm.company_id
WHERE p.email = 'carloscleton.nat@gmail.com'
   OR cm.role = 'owner'
ORDER BY p.email, c.trade_name;

-- PASSO 4: Contar roles
SELECT 
    role,
    COUNT(*) as total
FROM public.company_members
GROUP BY role
ORDER BY role;
