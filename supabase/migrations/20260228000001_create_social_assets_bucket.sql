-- Create a storage bucket for social media assets
insert into storage.buckets (id, name, public) 
values ('social_media_assets', 'social_media_assets', true)
on conflict (id) do update set public = true;

-- Policy for public reading
create policy "public_access_social_assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'social_media_assets');

-- Policy for authenticated users to insert
create policy "authenticated_users_can_insert_social_assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'social_media_assets' 
  AND auth.role() = 'authenticated'
);

-- Policy for authenticated users to update
create policy "authenticated_users_can_update_social_assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'social_media_assets' 
  AND auth.role() = 'authenticated'
);

-- Policy for authenticated users to delete
create policy "authenticated_users_can_delete_social_assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'social_media_assets' 
  AND auth.role() = 'authenticated'
);
