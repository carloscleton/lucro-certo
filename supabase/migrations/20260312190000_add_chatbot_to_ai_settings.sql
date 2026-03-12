-- Migration: Add ChatBot AI support to lead radar
ALTER TABLE public.company_ai_settings 
ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

COMMENT ON COLUMN public.company_ai_settings.chat_enabled IS 'Se o robô deve responder mensagens dos leads automaticamente usando IA';
