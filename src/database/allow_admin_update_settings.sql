-- PERMISSÃO PARA ADMINS ATUALIZAREM CONFIGURAÇÕES DA EMPRESA
-- Atualmente, talvez apenas o Dono (Owner) possa editar a empresa.
-- Esse script cria uma política (POLICY) que permite Admins editarem a coluna 'settings'.

-- 1. Habilitar RLS na tabela companies (caso não esteja)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Recriar Política para permitir UPDATE por membros com cargo de 'admin' ou 'owner'
-- DROP para evitar erro se já existir
DROP POLICY IF EXISTS "Admins podem editar empresa" ON public.companies;
DROP POLICY IF EXISTS "Admins e Donos podem atualizar configurações da empresa" ON public.companies;

CREATE POLICY "Admins e Donos podem atualizar configurações da empresa"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.company_members cm 
    WHERE cm.company_id = companies.id 
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'admin')
  )
);

-- NOTA: Se já existir uma policy de update conflitante, pode ser necessário removê-la antes ou ajustar.
-- Tente rodar. Se der erro de "policy already exists", me avise.
