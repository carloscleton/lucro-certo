-- =============================================================
-- SCRIPT DE LIMPEZA: Remove despesas duplicadas de orçamentos
-- Contexto: Quando um orçamento era aprovado e depois editado,
-- o sistema estava salvando a receita do orçamento novamente
-- como uma despesa com o prefixo [ORÇ] Ref. Orçamento:
--
-- COMO RODAR:
-- 1. Acesse https://supabase.com/dashboard
-- 2. Vá em SQL Editor
-- 3. Cole e execute este script
-- =============================================================

-- PASSO 1: Visualize quais registros serão excluídos (seguro, só lê)
SELECT 
    id,
    description,
    amount,
    date,
    type,
    quote_id
FROM transactions
WHERE 
    type = 'expense'
    AND description LIKE '[ORÇ] Ref. Orçamento:%'
    AND quote_id IS NOT NULL
ORDER BY date DESC;

-- PASSO 2: Depois de confirmar que os registros acima são os corretos,
-- execute o DELETE abaixo (comente o SELECT acima primeiro):

-- DELETE FROM transactions
-- WHERE 
--     type = 'expense'
--     AND description LIKE '[ORÇ] Ref. Orçamento:%'
--     AND quote_id IS NOT NULL;
