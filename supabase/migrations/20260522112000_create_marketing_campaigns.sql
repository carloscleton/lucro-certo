-- Create marketing_campaigns table
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    button_text TEXT,
    button_link TEXT,
    theme TEXT DEFAULT 'info', -- 'promo', 'info', 'warning'
    image_url TEXT,
    show_in_popup BOOLEAN DEFAULT false,
    show_in_hero BOOLEAN DEFAULT false,
    show_as_section BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active campaigns
CREATE POLICY "Public can read active marketing campaigns"
    ON public.marketing_campaigns
    FOR SELECT
    USING (is_active = true);

-- Allow authenticated admins to do everything
DROP POLICY IF EXISTS "Admins can manage marketing campaigns" ON public.marketing_campaigns;
CREATE POLICY "Admins can manage marketing campaigns"
    ON public.marketing_campaigns
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND (user_type = 'admin' OR email = 'carloscleton.nat@gmail.com')
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at_marketing_campaigns()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_updated_at_marketing_campaigns
    BEFORE UPDATE ON public.marketing_campaigns
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at_marketing_campaigns();
