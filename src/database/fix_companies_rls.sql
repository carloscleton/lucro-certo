-- FIX RLS FOR COMPANIES TABLE 🛡️

-- 1. Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Allow SELECT for members of the company
DROP POLICY IF EXISTS "Membros podem ver sua própria empresa" ON public.companies;
CREATE POLICY "Membros podem ver sua própria empresa"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.company_members cm 
    WHERE cm.company_id = companies.id 
    AND cm.user_id = auth.uid()
  )
);

-- 3. Allow UPDATE for owners and admins
DROP POLICY IF EXISTS "Admins e Donos podem atualizar a empresa" ON public.companies;
CREATE POLICY "Admins e Donos podem atualizar a empresa"
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

-- 4. Special Case: Allow creator to see their companies even without membership record (failsafe)
DROP POLICY IF EXISTS "Criadores podem ver suas empresas" ON public.companies;
CREATE POLICY "Criadores podem ver suas empresas"
ON public.companies
FOR ALL
TO authenticated
USING (user_id = auth.uid());
