CREATE TABLE IF NOT EXISTS social_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    niche TEXT NOT NULL,
    tone TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE social_profiles ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view social profiles of their companies"
    ON social_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_profiles.company_id
            AND company_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert social profiles for their companies"
    ON social_profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_profiles.company_id
            AND company_members.user_id = auth.uid()
            AND company_members.role IN ('admin', 'member')
        )
    );

CREATE POLICY "Users can update social profiles of their companies"
    ON social_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_profiles.company_id
            AND company_members.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_profiles.company_id
            AND company_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete social profiles of their companies"
    ON social_profiles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_profiles.company_id
            AND company_members.user_id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION update_social_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_social_profiles_timestamp
    BEFORE UPDATE ON social_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_social_profiles_updated_at();
