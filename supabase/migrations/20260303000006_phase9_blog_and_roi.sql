-- Phase 9: Integrated SEO Blog Automation & ROI Intelligence
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    slug TEXT UNIQUE,
    status TEXT DEFAULT 'draft', -- draft, published, scheduled
    seo_score INTEGER,
    conversion_count INTEGER DEFAULT 0,
    estimated_roi_value DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage blog posts of their companies"
    ON public.blog_posts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members
            WHERE company_members.company_id = blog_posts.company_id
            AND company_members.user_id = auth.uid()
        )
    );

ALTER TABLE public.social_profiles 
    ADD COLUMN IF NOT EXISTS blog_autopilot_enabled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS blog_autopilot_frequency TEXT DEFAULT 'weekly';

ALTER TABLE public.social_posts 
    ADD COLUMN IF NOT EXISTS conversion_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS estimated_roi_value DECIMAL(12,2) DEFAULT 0;
