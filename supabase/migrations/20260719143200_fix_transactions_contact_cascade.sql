-- Recriar a constraint de contact_id na tabela transactions com ON DELETE SET NULL
-- para preservar histórico financeiro ao excluir um cliente/fornecedor
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_contact_id_fkey;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
