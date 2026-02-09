-- MARTEADA FINAL 🔨
-- Esse script força a atualização ignorando qualquer validação anterior.

UPDATE public.companies
SET settings = jsonb_build_object(
    'quote_validity_days', 5,
    'commission_rate', COALESCE((settings->>'commission_rate')::numeric, 0),
    'service_commission_rate', COALESCE((settings->>'service_commission_rate')::numeric, 0),
    'product_commission_rate', COALESCE((settings->>'product_commission_rate')::numeric, 0)
)
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'carloscleton.nat@gmail.com');

-- Confirmação (Vai mostrar o que ficou salvo)
SELECT trade_name, settings 
FROM public.companies 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'carloscleton.nat@gmail.com');
