-- SCRIT PARA SINCRONIZAR O BANCO DE DADOS COM AS NOVAS FUNCIONALIDADES
-- Rode este script no SQL Editor do seu Supabase Dashboard

-- 1. Garantir que a tabela 'companies' tenha a coluna 'phone' (WhatsApp principal da empresa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'phone') THEN
        ALTER TABLE public.companies ADD COLUMN phone TEXT;
    END IF;
END;
$$;

-- 2. Garantir que a tabela 'user_settings' tenha as novas colunas de automação
-- Isso é necessário para as configurações pessoais do usuário (quando não há empresa selecionada)
DO $$
BEGIN
    -- Lista de colunas a serem adicionadas se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_financial_reminders') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_financial_reminders BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_financial_time') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_financial_time TEXT DEFAULT '08:00';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_financial_prompt') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_financial_prompt TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_financial_template') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_financial_template TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_birthday_reminders') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_birthday_reminders BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_birthday_time') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_birthday_time TEXT DEFAULT '09:00';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_birthday_prompt') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_birthday_prompt TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_birthday_template') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_birthday_template TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_overdue_reminders') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_overdue_reminders BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_overdue_time') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_overdue_time TEXT DEFAULT '10:00';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_overdue_prompt') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_overdue_prompt TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_overdue_template') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_overdue_template TEXT;
    END IF;

    -- COLUNA NOVA: WhatsApp específico para automação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'automation_whatsapp_number') THEN
        ALTER TABLE public.user_settings ADD COLUMN automation_whatsapp_number TEXT;
    END IF;
END;
$$;

-- 3. Adicionar comentários para clareza
COMMENT ON COLUMN companies.phone IS 'WhatsApp oficial da empresa (usado para notificações e fallback)';
COMMENT ON COLUMN user_settings.automation_whatsapp_number IS 'Número específico para receber resumos administrativos';

-- 4. Garantir que o módulo de automações esteja ativado na matriz de permissões padrão para novas empresas (opcional)
-- Isso atualiza o RPC se necessário, mas como já atualizamos o RPC create_company manualmente nos arquivos, 
-- este script foca na estrutura das tabelas.
