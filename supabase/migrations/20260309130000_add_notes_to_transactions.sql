-- Add notes column to transactions
ALTER TABLE IF EXISTS public.transactions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index for searching notes if needed
CREATE INDEX IF NOT EXISTS idx_transactions_notes ON public.transactions USING gin (to_tsvector('portuguese', COALESCE(notes, '')));
