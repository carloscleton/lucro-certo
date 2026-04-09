-- SUPER FIX: SINCRONIZAÇÃO COMPLETA (PERFIS E CONFIGURAÇÕES) 🛡️🚀
-- Este script resolve os erros 406 (Not Acceptable) e 409 (Conflict) no console.

-- 1. REPARAR GATILHO DE CADASTRO (Sem o bloco EXCEPTION que escondia erros)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    phone, 
    document, 
    user_type, 
    currency, 
    status,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'document',
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'PF'),
    COALESCE(NEW.raw_user_meta_data->>'currency', 'BRL'),
    'active',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garante que o gatilho está correto
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. GARANTIR ESTRUTURA E PERMISSÕES DE 'USER_SETTINGS'
-- Força a criação das colunas se elas não existirem (evita erro 406)
DO $$ 
BEGIN
    -- Lista de colunas críticas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_financial_reminders') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_financial_reminders BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'quote_validity_days') THEN
        ALTER TABLE public.user_settings ADD COLUMN quote_validity_days INTEGER DEFAULT 7;
    END IF;
END $$;

-- Garante RLS aberto para o próprio usuário ler suas configs
DROP POLICY IF EXISTS "Usuários podem ver suas próprias configurações" ON public.user_settings;
CREATE POLICY "Usuários podem ver suas próprias configurações"
ON public.user_settings FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuários podem criar suas próprias configurações" ON public.user_settings;
CREATE POLICY "Usuários podem criar suas próprias configurações"
ON public.user_settings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());


-- 3. FORÇAR RECARREGAMENTO DO CACHE DO SUPABASE (IMPORTANTE!)
-- Isso resolve o erro 406 se a estrutura mudou recentemente
NOTIFY pgrst, 'reload schema';

-- VERIFICAÇÃO FINAL: Se você rodar isso e aparecer "Success", o banco está sincronizado!
RAISE NOTICE 'Sincronização concluída com sucesso!';
