-- Add status column to profiles and companies
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE IF EXISTS public.companies 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Optional: Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
