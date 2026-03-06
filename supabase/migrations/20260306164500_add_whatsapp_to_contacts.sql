-- Add whatsapp field to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS whatsapp TEXT;

COMMENT ON COLUMN public.contacts.whatsapp IS 'Número de WhatsApp específico para automações';
