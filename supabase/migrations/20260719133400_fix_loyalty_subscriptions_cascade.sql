-- 1. Recriar a constraint de contact_id na tabela loyalty_subscriptions com ON DELETE CASCADE
ALTER TABLE public.loyalty_subscriptions 
DROP CONSTRAINT IF EXISTS loyalty_subscriptions_contact_id_fkey;

ALTER TABLE public.loyalty_subscriptions
ADD CONSTRAINT loyalty_subscriptions_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;
