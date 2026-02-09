-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(10) DEFAULT 'POST' CHECK (method IN ('POST', 'GET', 'PUT', 'PATCH')),
    events TEXT[] NOT NULL DEFAULT '{}',
    headers JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_webhooks_company_id ON webhooks(company_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);

-- Enable RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for webhooks
CREATE POLICY "Users can view their own webhooks"
    ON webhooks FOR SELECT
    USING (
        auth.uid() = user_id OR 
        company_id IN (
            SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own webhooks"
    ON webhooks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhooks"
    ON webhooks FOR UPDATE
    USING (
        auth.uid() = user_id OR 
        company_id IN (
            SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own webhooks"
    ON webhooks FOR DELETE
    USING (
        auth.uid() = user_id OR 
        company_id IN (
            SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
    );
