-- Add approval_whatsapp column to social_profiles
ALTER TABLE public.social_profiles ADD COLUMN IF NOT EXISTS approval_whatsapp TEXT;
