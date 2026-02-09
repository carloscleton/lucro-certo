-- SEGURANÇA FINAL DA EQUIPE (PRODUÇÃO) 🛡️
-- Este script garante que todos os membros ativos da empresa possam colaborar em Orçamentos, Contatos e Produtos.

-- 1. Permissões para QUOTES (Orçamentos)
DROP POLICY IF EXISTS "Equipe pode ver todos os orçamentos da empresa" ON public.quotes;
CREATE POLICY "Equipe pode ver todos os orçamentos da empresa"
ON public.quotes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = quotes.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Equipe pode editar orçamentos da empresa" ON public.quotes;
CREATE POLICY "Equipe pode editar orçamentos da empresa"
ON public.quotes FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = quotes.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Equipe pode excluir orçamentos da empresa" ON public.quotes;
CREATE POLICY "Equipe pode excluir orçamentos da empresa"
ON public.quotes FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = quotes.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
    AND cm.role IN ('owner', 'admin') -- Apenas Admins/Donos excluem
  )
);

-- 2. Permissões para QUOTE_ITEMS (Itens do Orçamento)
DROP POLICY IF EXISTS "Equipe pode gerenciar itens de orçamento" ON public.quote_items;
CREATE POLICY "Equipe pode gerenciar itens de orçamento"
ON public.quote_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.company_members cm ON cm.company_id = q.company_id
    WHERE q.id = quote_items.quote_id
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

-- 3. Permissões para CONTACTS (Contatos/Clientes)
DROP POLICY IF EXISTS "Equipe pode ver todos os contatos da empresa" ON public.contacts;
CREATE POLICY "Equipe pode ver todos os contatos da empresa"
ON public.contacts FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = contacts.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Equipe pode gerenciar contatos da empresa" ON public.contacts;
CREATE POLICY "Equipe pode gerenciar contatos da empresa"
ON public.contacts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = contacts.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

-- 4. Permissões para PRODUCTS (Produtos)
DROP POLICY IF EXISTS "Equipe pode ver todos os produtos da empresa" ON public.products;
CREATE POLICY "Equipe pode ver todos os produtos da empresa"
ON public.products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = products.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Equipe pode gerenciar produtos da empresa" ON public.products;
CREATE POLICY "Equipe pode gerenciar produtos da empresa"
ON public.products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = products.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

-- 5. Permissões para SERVICES (Serviços) - Opcional mas recomendado
DROP POLICY IF EXISTS "Equipe pode ver todos os serviços da empresa" ON public.services;
CREATE POLICY "Equipe pode ver todos os serviços da empresa"
ON public.services FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = services.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Equipe pode gerenciar serviços da empresa" ON public.services;
CREATE POLICY "Equipe pode gerenciar serviços da empresa"
ON public.services FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm 
    WHERE cm.company_id = services.company_id 
    AND cm.user_id = auth.uid()
    AND cm.status = 'active'
  )
);

-- FIM DO SCRIPT DE SEGURANÇA ✅
