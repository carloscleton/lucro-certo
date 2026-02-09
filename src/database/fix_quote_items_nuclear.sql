-- REPARO NUCLEAR: ITENS DE ORÇAMENTO (QUOTE_ITEMS) ☢️🛡️
-- Este script força a criação das colunas, limpa permissões e recarrega o cache do sistema.

-- 1. FORÇAR ADIÇÃO DE COLUNAS (Caso o script anterior tenha falhado silenciosamente)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='ncm') THEN
        ALTER TABLE public.quote_items ADD COLUMN ncm VARCHAR(8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='cest') THEN
        ALTER TABLE public.quote_items ADD COLUMN cest VARCHAR(7);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='origem') THEN
        ALTER TABLE public.quote_items ADD COLUMN origem INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='codigo_servico_municipal') THEN
        ALTER TABLE public.quote_items ADD COLUMN codigo_servico_municipal VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='item_lista_servico') THEN
        ALTER TABLE public.quote_items ADD COLUMN item_lista_servico VARCHAR(10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quote_items' AND column_name='show_in_pdf') THEN
        ALTER TABLE public.quote_items ADD COLUMN show_in_pdf BOOLEAN DEFAULT true;
    END IF;
END $$;

-- 2. RESET TOTAL DE PERMISSÕES (RLS)
-- Vamos garantir que você consiga ler TUDO desta tabela por enquanto para debug.
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Equipe pode gerenciar itens de orçamento" ON public.quote_items;
DROP POLICY IF EXISTS "Users can view their own quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Users can manage their own quote items" ON public.quote_items;
DROP POLICY IF EXISTS "Acesso aos itens baseado no orçamento pai" ON public.quote_items;
DROP POLICY IF EXISTS "Controle total via Orçamento Pai" ON public.quote_items;
DROP POLICY IF EXISTS "Permissao temporaria para itens" ON public.quote_items;

CREATE POLICY "DEBUG_TOTAL_ACCESS"
ON public.quote_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. RECARREGAR CACHE DE SCHEMA (EXTREMAMENTE IMPORTANTE)
-- Isso força o Supabase a reconhecer as novas colunas IMEDIATAMENTE.
NOTIFY pgrst, 'reload schema';

-- 4. VERIFICAÇÃO FINAL
-- Rode isso para ter certeza:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'quote_items';
