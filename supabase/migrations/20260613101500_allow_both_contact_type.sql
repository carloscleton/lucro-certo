-- Migration: Allow 'both' type for contacts (both client and supplier)
-- Drop existing check constraint if it exists and add a new one

DO $$
BEGIN
    -- Drop the constraint if it exists. Typically named contacts_type_check or similar.
    ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_type_check;
    ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_type_check1;
END;
$$;

-- Add check constraint to allow 'client', 'supplier', and 'both'
ALTER TABLE public.contacts ADD CONSTRAINT contacts_type_check CHECK (type IN ('client', 'supplier', 'both'));
