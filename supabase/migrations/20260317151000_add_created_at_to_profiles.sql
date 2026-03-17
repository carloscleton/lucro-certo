-- Add created_at to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Update existing profiles to have a created_at if null (optional, as default now() handles new ones)
UPDATE public.profiles SET created_at = now() WHERE created_at IS NULL;
