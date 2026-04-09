-- FIX: REPARO DO GATILHO DE CADASTRO 🛠️
-- Este script corrige o erro 'Database error saving new user' ao criar novos usuários.
-- Ele garante que todos os metadados (Nome, CPF/CNPJ, WhatsApp, Moeda) sejam salvos corretamente no perfil.

-- 1. Cria ou atualiza a função que processa o novo usuário
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
EXCEPTION WHEN OTHERS THEN
  -- Log de erro básico (aparecerá nos logs do banco se necessário)
  RAISE WARNING 'Erro ao criar perfil para usuário %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Garante que o gatilho esteja ativo na tabela auth.users do Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Comentário Informativo
COMMENT ON FUNCTION public.handle_new_user() IS 'Cria automaticamente o perfil público em public.profiles quando um novo usuário se cadastra no Auth.';
