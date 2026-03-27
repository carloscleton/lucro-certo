-- ================================================================================
-- ADD LOYALTY NOTIFICATION SETTINGS
-- Description: Adds templates and flags for automated Loyalty plan delivery.
-- ================================================================================

ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS loyalty_whatsapp_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS loyalty_whatsapp_template TEXT DEFAULT 'Olá, {name}! 👋 Seu link para ativar o {plan_name} no Clube VIP (R$ {price}) está pronto: {payment_link}. Após o pagamento, seu acesso será liberado automaticamente!',
ADD COLUMN IF NOT EXISTS loyalty_email_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS loyalty_email_template TEXT DEFAULT '<html><body><h1>Seu Link VIP está pronto!</h1><p>Olá, {name},</p><p>O seu link de pagamento para o plano <strong>{plan_name}</strong> está disponível: <a href="{payment_link}">{payment_link}</a></p><p>Valor: R$ {price}</p></body></html>';

COMMENT ON COLUMN public.app_settings.loyalty_whatsapp_enabled IS 'Se o envio automático de WhatsApp para novos planos está ativo';
COMMENT ON COLUMN public.app_settings.loyalty_whatsapp_template IS 'Template da mensagem do Clube VIP (suporta {name}, {plan_name}, {payment_link}, {price})';
COMMENT ON COLUMN public.app_settings.loyalty_email_enabled IS 'Se o sistema deve enviar e-mail customizado via Resend';
COMMENT ON COLUMN public.app_settings.loyalty_email_template IS 'Template HTML do e-mail (suporta {name}, {plan_name}, {payment_link}, {price})';

-- Update default values for existing row
UPDATE public.app_settings 
SET 
    loyalty_whatsapp_enabled = true,
    loyalty_whatsapp_template = 'Olá, {name}! 👋 Seu link para ativar o {plan_name} no Clube VIP (R$ {price}) está pronto: {payment_link}. Após o pagamento, seu acesso será liberado automaticamente!',
    loyalty_email_enabled = true,
    loyalty_email_template = '<html><body><h1>Seu Link VIP está pronto!</h1><p>Olá, {name},</p><p>O seu link de pagamento para o plano <strong>{plan_name}</strong> está disponível: <a href="{payment_link}">{payment_link}</a></p><p>Valor: R$ {price}</p></body></html>'
WHERE id = 1;
