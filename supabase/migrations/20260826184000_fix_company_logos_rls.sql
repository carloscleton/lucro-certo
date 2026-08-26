-- Fix RLS policies for company-logos bucket
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

-- Recreate policies with support for the 'logos/' folder prefix
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' AND
  (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies 
      WHERE id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
    OR
    (
      (storage.foldername(name))[1] = 'logos' AND
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.companies 
        WHERE id IN (
          SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies 
      WHERE id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
    OR
    (
      (storage.foldername(name))[1] = 'logos' AND
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.companies 
        WHERE id IN (
          SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.companies 
      WHERE id IN (
        SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
      )
    )
    OR
    (
      (storage.foldername(name))[1] = 'logos' AND
      (storage.foldername(name))[2] IN (
        SELECT id::text FROM public.companies 
        WHERE id IN (
          SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
      )
    )
  )
);
