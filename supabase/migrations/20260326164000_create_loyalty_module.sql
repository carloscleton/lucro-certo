-- ================================================================================
-- LOYALTY MODULE MIGRATION
-- Created: 2026-03-26
-- Description: Foundation for the Loyalty Club (Clube de Fidelidade) module.
-- ================================================================================

-- 0. ADD COLUMN TO COMPANIES TABLE
ALTER TABLE companies ADD COLUMN IF NOT EXISTS loyalty_module_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- 1. LOYALTY SETTINGS (Per company configuration)
CREATE TABLE IF NOT EXISTS loyalty_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT FALSE,
    platform_fee_percent DECIMAL(5,2) DEFAULT 5.00,
    trial_days INTEGER DEFAULT 0,
    trial_started_at TIMESTAMP WITH TIME ZONE,
    gateway_type TEXT DEFAULT 'asaas', -- 'asaas' | 'mercadopago'
    gateway_api_key TEXT, -- Encrypted in application layer
    due_day INTEGER DEFAULT 10 CHECK (due_day >= 1 AND due_day <= 28),
    grace_days INTEGER DEFAULT 3,
    alert_on_checkin BOOLEAN DEFAULT TRUE,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id)
);

-- 2. LOYALTY PLANS
CREATE TABLE IF NOT EXISTS loyalty_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_percent DECIMAL(5,2) DEFAULT 0.00,
    included_services UUID[] DEFAULT '{}',
    billing_cycle TEXT DEFAULT 'monthly',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. LOYALTY SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS loyalty_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES loyalty_plans(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending', -- 'pending', 'active', 'overdue', 'suspended', 'cancelled'
    started_at TIMESTAMP WITH TIME ZONE,
    next_due_at DATE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_reason TEXT,
    gateway_customer_id TEXT,
    gateway_sub_id TEXT,
    portal_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. LOYALTY CHARGES
CREATE TABLE IF NOT EXISTS loyalty_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES loyalty_subscriptions(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES loyalty_plans(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- Integration with finance
    amount DECIMAL(12,2) NOT NULL,
    platform_fee DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'cancelled'
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    gateway_charge_id TEXT,
    gateway_payment_url TEXT,
    reference_month TEXT, -- e.g., "2026-04"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES

ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_charges ENABLE ROW LEVEL SECURITY;

-- Simple RLS: Company members can see their own company's loyalty data
CREATE POLICY "Company members can manage loyalty settings" ON loyalty_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE memberships.company_id = loyalty_settings.company_id 
            AND memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "Company members can manage loyalty plans" ON loyalty_plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE memberships.company_id = loyalty_plans.company_id 
            AND memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "Company members can manage loyalty subscriptions" ON loyalty_subscriptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE memberships.company_id = loyalty_subscriptions.company_id 
            AND memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "Company members can manage loyalty charges" ON loyalty_charges
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships 
            WHERE memberships.company_id = loyalty_charges.company_id 
            AND memberships.user_id = auth.uid()
        )
    );

-- PUBLIC ACCESS for portal (via token)
CREATE POLICY "Public access to subscriptions via token" ON loyalty_subscriptions
    FOR SELECT USING (TRUE); -- We will filter by token in the app logic

-- INDEXES
CREATE INDEX idx_loyalty_settings_company ON loyalty_settings(company_id);
CREATE INDEX idx_loyalty_plans_company ON loyalty_plans(company_id);
CREATE INDEX idx_loyalty_subscriptions_company ON loyalty_subscriptions(company_id);
CREATE INDEX idx_loyalty_subscriptions_contact ON loyalty_subscriptions(contact_id);
CREATE INDEX idx_loyalty_subscriptions_token ON loyalty_subscriptions(portal_token);
CREATE INDEX idx_loyalty_charges_subscription ON loyalty_charges(subscription_id);
CREATE INDEX idx_loyalty_charges_company ON loyalty_charges(company_id);
CREATE INDEX idx_loyalty_charges_transaction ON loyalty_charges(transaction_id);
-- 4. UPDATE CREATE COMPANY RPC (Includes slug and loyalty defaults)
CREATE OR REPLACE FUNCTION public.create_company(
    name_input TEXT,
    trade_name_input TEXT,
    cnpj_input TEXT,
    entity_type_input TEXT DEFAULT 'PJ',
    cpf_input TEXT DEFAULT NULL,
    email_input TEXT DEFAULT '',
    phone_input TEXT DEFAULT '',
    address_input TEXT DEFAULT '',
    zip_code_input TEXT DEFAULT NULL,
    street_input TEXT DEFAULT NULL,
    number_input TEXT DEFAULT NULL,
    complement_input TEXT DEFAULT NULL,
    neighborhood_input TEXT DEFAULT NULL,
    city_input TEXT DEFAULT NULL,
    state_input TEXT DEFAULT NULL,
    slug_input TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_company_id UUID;
    current_count INTEGER;
    max_limit INTEGER;
BEGIN
    -- Get current count of companies owned by user
    SELECT COUNT(*) INTO current_count
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid() AND cm.role = 'admin';

    -- Get user's max limit
    SELECT max_companies INTO max_limit
    FROM public.profiles
    WHERE id = auth.uid();

    -- Use default 1 if null
    IF max_limit IS NULL THEN
        max_limit := 1;
    END IF;

    -- Check limit
    IF current_count >= max_limit THEN
        RETURN json_build_object('success', false, 'message', 'Limite de empresas atingido. Contate o suporte para aumentar seu plano.');
    END IF;

    -- Create Company
    INSERT INTO public.companies (
        legal_name, 
        trade_name, 
        cnpj, 
        entity_type,
        cpf,
        email, 
        phone, 
        address, 
        user_id,
        zip_code,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        slug,
        allowed_entity_types
    )
    VALUES (
        name_input, 
        trade_name_input, 
        cnpj_input, 
        COALESCE(entity_type_input, 'PJ'),
        cpf_input,
        email_input, 
        phone_input, 
        address_input, 
        auth.uid(),
        zip_code_input,
        street_input,
        number_input,
        complement_input,
        neighborhood_input,
        city_input,
        state_input,
        slug_input,
        ARRAY['PF', 'PJ']
    )
    RETURNING id INTO new_company_id;

    -- Create Membership (Admin by default)
    INSERT INTO public.company_members (company_id, user_id, role, status)
    VALUES (new_company_id, auth.uid(), 'admin', 'active');

    -- Create default settings for the company
    UPDATE public.companies 
    SET settings = jsonb_build_object(
        'member_can_delete', false,
        'modules', jsonb_build_object(
            'dashboard', jsonb_build_object('admin', true, 'member', true),
            'quotes', jsonb_build_object('admin', true, 'member', true),
            'receivables', jsonb_build_object('admin', true, 'member', true),
            'payables', jsonb_build_object('admin', true, 'member', true),
            'categories', jsonb_build_object('admin', true, 'member', true),
            'companies', jsonb_build_object('admin', true, 'member', true),
            'contacts', jsonb_build_object('admin', true, 'member', true),
            'services', jsonb_build_object('admin', true, 'member', true),
            'products', jsonb_build_object('admin', true, 'member', true),
            'commissions', jsonb_build_object('admin', true, 'member', false),
            'reports', jsonb_build_object('admin', true, 'member', false),
            'settings', jsonb_build_object('admin', true, 'member', false),
            'whatsapp', jsonb_build_object('admin', true, 'member', false),
            'payments', jsonb_build_object('admin', true, 'member', false),
            'loyalty', jsonb_build_object('admin', true, 'member', false)
        ),
        'settings_tabs', jsonb_build_object(
            'quotes', jsonb_build_object('admin', true, 'member', false),
            'financial', jsonb_build_object('admin', true, 'member', false),
            'team', jsonb_build_object('admin', true, 'member', false),
            'webhooks', jsonb_build_object('admin', true, 'member', false),
            'permissions', jsonb_build_object('admin', false, 'member', false),
            'whatsapp', jsonb_build_object('admin', true, 'member', false),
            'payments', jsonb_build_object('admin', true, 'member', false),
            'automations', jsonb_build_object('admin', true, 'member', false),
            'subscription', jsonb_build_object('admin', true, 'member', false)
        )
    )
    WHERE id = new_company_id;

    RETURN json_build_object('success', true, 'company_id', new_company_id);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- TRIGGERS for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_loyalty_settings_updated_at BEFORE UPDATE ON loyalty_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_loyalty_plans_updated_at BEFORE UPDATE ON loyalty_plans FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_loyalty_subscriptions_updated_at BEFORE UPDATE ON loyalty_subscriptions FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_loyalty_charges_updated_at BEFORE UPDATE ON loyalty_charges FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
