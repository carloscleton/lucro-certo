-- CORREÇÃO DE PERMISSÕES DE TRANSAÇÕES (A PAGAR/A RECEBER) 🛠️
-- Este script corrige o erro de "Permissão negada" ao atualizar/baixar contas.

-- 1. Habilitar RLS (garantir que está ativo)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas que podem estar bloqueando (ex: apenas criador pode editar)
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions of their company" ON public.transactions;

-- 3. Criar Nova Política de Atualização (UPDATE)
-- Permite editar se:
-- A) For transação pessoal (sem empresa) e você for o dono.
-- B) For transação de empresa e você for membro dessa empresa (Admin, Dono ou Membro).

CREATE POLICY "Users can update transactions of their company"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  (company_id IS NULL AND user_id = auth.uid()) -- Pessoal
  OR
  EXISTS ( -- Empresa
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = transactions.company_id
    AND cm.user_id = auth.uid()
    -- Se quiser restringir apenas para Admins/Owners, descomente a linha abaixo:
    -- AND cm.role IN ('owner', 'admin') 
  )
);

-- 4. Garantir permissão de SELECT (Visualizar)
DROP POLICY IF EXISTS "Users can view transactions of their company" ON public.transactions;
CREATE POLICY "Users can view transactions of their company"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  (company_id IS NULL AND user_id = auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = transactions.company_id
    AND cm.user_id = auth.uid()
  )
);
