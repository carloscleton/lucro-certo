-- RLS Policies for orcamento-quote-pdfs bucket

-- Policy 1: Allow authenticated users to upload PDFs to their company folder
CREATE POLICY "Users can upload PDFs to their company folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'orcamento-quote-pdfs' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies 
        WHERE id IN (
            SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
    )
);

-- Policy 2: Allow authenticated users to update PDFs in their company folder
CREATE POLICY "Users can update PDFs in their company folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'orcamento-quote-pdfs' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies 
        WHERE id IN (
            SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
    )
);

-- Policy 3: Allow public read access to all PDFs (for webhook and sharing)
CREATE POLICY "Public read access to all PDFs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'orcamento-quote-pdfs');

-- Policy 4: Allow authenticated users to delete PDFs from their company folder
CREATE POLICY "Users can delete PDFs from their company folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'orcamento-quote-pdfs' AND
    (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies 
        WHERE id IN (
            SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
    )
);
