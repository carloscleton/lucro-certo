-- CORREÇÃO DEFINITIVA: ITENS DE ORÇAMENTO (QUOTE_ITEMS) 🛡️🚀
-- Este script adiciona todas as colunas que estão faltando e corrige as permissões de uma vez só.

-- 1. ADICIONAR COLUNAS FALTANTES (Se não existirem)
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS ncm VARCHAR(8);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS cest VARCHAR(7);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS origem INTEGER DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS codigo_servico_municipal VARCHAR(20);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS item_lista_servico VARCHAR(10);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS show_in_pdf BOOLEAN DEFAULT true;

-- 2. HABILITAR RLS (Garantir que está ativo)
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- 3. REMOVER POLÍTICAS ANTIGAS QUE PODEM BLOQUEAR O ACESSO
DROP POLICY IF EXISTS "Equipe pode gerenciar itens de orçamento" ON public.quote_items;
DROP POLICY IF EXISTS "Users can view their own quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Users can manage their own quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Acesso aos itens baseado no orçamento pai" ON public.quote_items;

-- 4. CRIAR NOVA POLÍTICA SIMPLIFICADA E ROBUSTA
-- Dá acesso total (SELECT, INSERT, UPDATE, DELETE) para usuários que tem acesso ao Orçamento pai.
CREATE POLICY "Controle total via Orçamento Pai"
ON public.quote_items
FOR ALL -- SELECT, INSERT, UPDATE, DELETE
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

-- 5. COMENTÁRIOS PARA DOCUMENTAÇÃO
COMMENT ON COLUMN quote_items.codigo_servico_municipal IS 'Código do serviço na prefeitura';
COMMENT ON COLUMN quote_items.item_lista_servico IS 'Item da LC 116/2003';
COMMENT ON COLUMN quote_items.show_in_pdf IS 'Se o item deve aparecer na impressão do PDF';

-- FIM DA CORREÇÃO DEFINITIVA ✅
