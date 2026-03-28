-- ================================================================================
-- FIX LOYALTY WHATSAPP TEMPLATE URL
-- Description: Removes the trailing dot after the payment link to avoid click errors.
-- ================================================================================

UPDATE public.app_settings 
SET 
    loyalty_whatsapp_template = 'Olá, {name}! 👋 Seu link para ativar o {plan_name} no Clube VIP (R$ {price}) está pronto: {payment_link} . Após o pagamento, seu acesso será liberado automaticamente!'
WHERE id = 1;
