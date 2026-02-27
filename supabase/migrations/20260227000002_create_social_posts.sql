CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, posted
    scheduled_for TIMESTAMP WITH TIME ZONE,
    posted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view social posts for their companies"
    ON social_posts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_posts.company_id
            AND company_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update social posts of their companies"
    ON social_posts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_posts.company_id
            AND company_members.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_posts.company_id
            AND company_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete social posts of their companies"
    ON social_posts FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM company_members
            WHERE company_members.company_id = social_posts.company_id
            AND company_members.user_id = auth.uid()
        )
    );

CREATE TRIGGER update_social_posts_timestamp
    BEFORE UPDATE ON social_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_social_profiles_updated_at();

-- pg_cron Extension logic usually requires elevated permissions.
-- We will instruct the Supabase Edge Function to be scheduled via the Supabase Dashboard "Cron" UI or we can script it if the pg_net extension is active.
-- For safety, we will just establish the table for now.
