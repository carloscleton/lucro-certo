-- Create storage bucket for company logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: Allow public read access to all logos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'company-logos' );

-- Policy 2: Allow authenticated users to upload logos to any folder (simplified for now, ideally restrict by folder name = company_id)
-- Using a simpler policy first to ensure it works, then refining. Actually let's restrict by company_id immediately for security.
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'company-logos' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.companies 
        WHERE id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
    )
);

-- Policy 3: Allow authenticated users to update logos
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'company-logos' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.companies 
        WHERE id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
    )
);

-- Policy 4: Allow authenticated users to delete logos
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'company-logos' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.companies 
        WHERE id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
    )
);
