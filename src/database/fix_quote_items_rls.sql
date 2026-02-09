-- CORREÇÃO DE RLS PARA ITENS DE ORÇAMENTO (QUOTE_ITEMS) 🛡️
-- Este script resolve o erro de "Items retrieved: 0" ao editar orçamentos.

-- 1. Habilitar RLS (garantir que está ativo)
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas restritivas
DROP POLICY IF EXISTS "Equipe pode gerenciar itens de orçamento" ON public.quote_items;
DROP POLICY IF EXISTS "Users can view their own quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Users can manage their own quote items" ON public.quote_items;

-- 3. Criar Nova Política Baseada no Acesso ao Orçamento Pai
-- Se o usuário pode ver o orçamentos (tabela quotes), ele pode ver os itens.
-- Isso simplifica a lógica e evita JOINs complexos que falham em casos de orçamentos pessoais.

CREATE POLICY "Acesso aos itens baseado no orçamento pai"
ON public.quote_items
FOR ALL -- Abrange SELECT, INSERT, UPDATE, DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
  )
);

-- FIM DA CORREÇÃO ✅
