-- Create storage bucket for transaction attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: Allow public read access to all attachments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access for Attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Public Access for Attachments"
    ON storage.objects FOR SELECT
    TO public
    USING ( bucket_id = 'attachments' );
  END IF;
END $$;

-- Policy 2: Allow authenticated users to upload attachments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can upload attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK ( bucket_id = 'attachments' );
  END IF;
END $$;

-- Policy 3: Allow authenticated users to delete their attachments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete attachments' AND tablename = 'objects') THEN
    CREATE POLICY "Authenticated users can delete attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING ( bucket_id = 'attachments' );
  END IF;
END $$;
