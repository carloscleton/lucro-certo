-- Create storage bucket for company logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: Allow public read access to all logos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects') THEN
    CREATE POLICY "Public Access"
    ON storage.objects FOR SELECT
    TO public
    USING ( bucket_id = 'company-logos' );
  END IF;
END $$;

-- Policy 2: Allow authenticated users to upload logos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload logos' AND tablename = 'objects') THEN
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
  END IF;
END $$;

-- Policy 3: Allow authenticated users to update logos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update logos' AND tablename = 'objects') THEN
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
  END IF;
END $$;

-- Policy 4: Allow authenticated users to delete logos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete logos' AND tablename = 'objects') THEN
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
  END IF;
END $$;
