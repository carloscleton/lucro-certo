-- SCRIPT DE INVESTIGAÇÃO
-- Rode isso no Supabase para ver ONDE está gravado o número 5.

-- 1. Verificando tabela de Configurações Pessoais
SELECT 
    p.email,
    us.* 
FROM public.user_settings us
JOIN public.profiles p ON p.id = us.user_id
WHERE p.email = 'carloscleton.nat@gmail.com';

-- 2. Verificando tabela de Empresas (Coluna settings)
SELECT 
    trade_name, 
    settings 
FROM public.companies
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'carloscleton.nat@gmail.com');
