-- CORREÇÃO TOTAL DE PERMISSÕES 🛡️

-- 1. Habilitar RLS nas tabelas (Segurança)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 2. Permissões para user_settings (Configs Pessoais)
-- Atualmente você não consegue ver suas próprias configs, por isso dá erro 409 (Conflito)
DROP POLICY IF EXISTS "Usuários podem ver suas próprias configurações" ON public.user_settings;
CREATE POLICY "Usuários podem ver suas próprias configurações"
ON public.user_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias configurações" ON public.user_settings;
CREATE POLICY "Usuários podem atualizar suas próprias configurações"
ON public.user_settings FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuários podem criar suas próprias configurações" ON public.user_settings;
CREATE POLICY "Usuários podem criar suas próprias configurações"
ON public.user_settings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());


-- 3. Permissões para companies (Configs da Empresa)
-- Permite Admins e Donos editarem a empresa
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
