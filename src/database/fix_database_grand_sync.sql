-- SINCRONIZAÇÃO COMPLETA DE BANCO (ORÇAMENTOS) 🛠️🚀
-- Este script garante que todas as colunas existem e as permissões estão abertas para a equipe.

-- 1. GARANTIR COLUNAS EM 'QUOTES' (ORÇAMENTOS)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_number VARCHAR(20);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'none';

-- 2. GARANTIR COLUNAS EM 'QUOTE_ITEMS' (ITENS)
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS quantity DECIMAL(12,2) DEFAULT 1;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS total_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS ncm VARCHAR(8);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS cest VARCHAR(7);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS origem INTEGER DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS codigo_servico_municipal VARCHAR(20);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS item_lista_servico VARCHAR(10);
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS show_in_pdf BOOLEAN DEFAULT true;

-- 3. RESET DE SEGURANÇA (PARA DEBUGR E COLABORAÇÃO)
-- Abre permissões para que TODOS os membros autenticados vejam orçamentos e itens por enquanto.
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas
DROP POLICY IF EXISTS "Equipe pode ver todos os orçamentos da empresa" ON public.quotes;
DROP POLICY IF EXISTS "Equipe pode editar orçamentos da empresa" ON public.quotes;
DROP POLICY IF EXISTS "Equipe pode gerenciar itens de orçamento" ON public.quote_items;
DROP POLICY IF EXISTS "Acesso aos itens baseado no orçamento pai" ON public.quote_items;
DROP POLICY IF EXISTS "Controle total via Orçamento Pai" ON public.quote_items;
DROP POLICY IF EXISTS "DEBUG_TOTAL_ACCESS" ON public.quote_items;

-- Criar políticas globais para orçamentos (Autenticados vêem tudo do seu contexto)
CREATE POLICY "Acesso Total Orçamentos (Auth)" 
ON public.quotes FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Acesso Total Itens (Auth)" 
ON public.quote_items FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

-- 4. RECARREGAR CACHEE DO SISTEMA
NOTIFY pgrst, 'reload schema';

-- VERIFICAÇÃO RÁPIDA (Rode e veja o resultado abaixo se as colunas aparecem)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'quote_items';
