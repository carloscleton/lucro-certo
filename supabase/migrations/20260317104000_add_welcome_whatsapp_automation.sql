-- Adiciona campos para Boas-vindas via WhatsApp 🚀
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS welcome_whatsapp_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS welcome_whatsapp_template TEXT DEFAULT 'Olá, {full_name}! 👋 Seja muito bem-vindo ao Lucro Certo. Já liberamos seus 7 dias de teste gratuito para a empresa {company_name}. Se precisar de qualquer ajuda, é só chamar aqui! 🚀',
ADD COLUMN IF NOT EXISTS platform_url TEXT DEFAULT 'https://lucrocerto.site',
ADD COLUMN IF NOT EXISTS supabase_anon_key TEXT;

COMMENT ON COLUMN public.app_settings.welcome_whatsapp_enabled IS 'Se as mensagens de boas-vindas automáticas estão ativas';
COMMENT ON COLUMN public.app_settings.welcome_whatsapp_template IS 'Template da mensagem de boas-vindas (suporta {full_name} e {company_name})';

-- Garante que as tabelas tenham os campos necessários
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT;

-- Função para disparar o webhook de boas-vindas
CREATE OR REPLACE FUNCTION public.trigger_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Dispara de forma assíncrona o Edge Function de boas-vindas
  PERFORM
    net.http_post(
      url := (SELECT platform_url FROM public.app_settings WHERE id = 1 LIMIT 1) || '/functions/v1/platform-welcome-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT supabase_anon_key FROM public.app_settings WHERE id = 1 LIMIT 1)
      ),
      body := jsonb_build_object('company_id', NEW.id)
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho ao criar empresa
DROP TRIGGER IF EXISTS on_company_created_welcome ON public.companies;
CREATE TRIGGER on_company_created_welcome
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_welcome_notification();
