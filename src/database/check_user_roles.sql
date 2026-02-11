-- Query para verificar roles dos usuários
SELECT 
    cm.id,
    cm.role,
    cm.status,
    cm.created_at,
    p.full_name,
    p.email,
    c.trade_name as empresa
FROM public.company_members cm
JOIN public.profiles p ON p.id = cm.user_id
JOIN public.companies c ON c.id = cm.company_id
ORDER BY cm.created_at DESC
LIMIT 20;
