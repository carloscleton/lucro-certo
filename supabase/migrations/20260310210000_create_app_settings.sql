-- Create app_settings table for global configurations
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    storage_provider TEXT DEFAULT 'supabase' CHECK (storage_provider IN ('supabase', 'r2')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert original settings
INSERT INTO app_settings (id, storage_provider)
VALUES (1, 'supabase')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read (for the app to know which provider to use)
CREATE POLICY "Public read app_settings" ON app_settings
    FOR SELECT USING (true);

-- Allow only super admin to update
-- We use the email check as seen in useAdmin.ts (carloscleton.nat@gmail.com)
CREATE POLICY "Super admin update app_settings" ON app_settings
    FOR UPDATE
    USING (auth.email() = 'carloscleton.nat@gmail.com')
    WITH CHECK (auth.email() = 'carloscleton.nat@gmail.com');
