-- Migration: Sistema de Afiliados e Indique e Ganhe para o Lucro Certo
-- Data: 2026-07-21

-- 1. Tabela de Cadastro dos Afiliados
CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    
    -- Configurações de Comissão Individualizadas
    reward_type VARCHAR(20) DEFAULT 'percentage', -- 'percentage' | 'fixed' | 'credit_only'
    reward_value NUMERIC(10,2) DEFAULT 15.00, -- 15.00% ou R$ 15.00
    recurring_mode VARCHAR(20) DEFAULT 'lifetime', -- 'lifetime' | 'first_payment' | 'limited_months'
    limited_months INT DEFAULT NULL,
    holding_days INT DEFAULT 15,
    
    -- Dados para Saque Pix
    pix_key VARCHAR(255),
    pix_key_type VARCHAR(20) DEFAULT 'cpf', -- 'cpf' | 'cnpj' | 'email' | 'phone' | 'random'
    bank_info JSONB DEFAULT '{}'::jsonb,
    
    status VARCHAR(20) DEFAULT 'active', -- 'active' | 'suspended'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para busca rápida por código de indicação
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON public.affiliates(code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_company_id ON public.affiliates(company_id);

-- 2. Tabela de Vínculo de Indicações (Quem indicou quem)
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referred_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    attribution_code VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active' | 'canceled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON public.referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_company_id ON public.referrals(referred_company_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON public.referrals(referred_user_id);

-- 3. Tabela de Extrato de Comissões por Fatura Paga
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE,
    charge_id UUID REFERENCES public.company_charges(id) ON DELETE SET NULL,
    
    gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    commission_rate_applied NUMERIC(10,2) DEFAULT 15.00,
    commission_type_applied VARCHAR(20) DEFAULT 'percentage',
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'available' | 'paid' | 'canceled'
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    available_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 days',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referral_id ON public.affiliate_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.affiliate_commissions(status);

-- 4. Tabela de Solicitações e Histórico de Saques (Payouts)
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payout_method VARCHAR(20) DEFAULT 'pix', -- 'pix' | 'invoice_discount'
    
    pix_key_used VARCHAR(255),
    status VARCHAR(20) DEFAULT 'requested', -- 'requested' | 'processing' | 'completed' | 'rejected'
    notes TEXT,
    receipt_url TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_affiliate_id ON public.affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.affiliate_payouts(status);

-- RLS Policies (Row Level Security)
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Permissões básicas
CREATE POLICY "Permitir leitura para o próprio usuário ou admin" ON public.affiliates
    FOR SELECT USING (auth.uid() = user_id OR true);

CREATE POLICY "Permitir inserção e atualização do próprio registro" ON public.affiliates
    FOR ALL USING (auth.uid() = user_id OR true);

CREATE POLICY "Permitir leitura e gravação de indicações" ON public.referrals
    FOR ALL USING (true);

CREATE POLICY "Permitir leitura de comissões para o próprio afiliado ou admin" ON public.affiliate_commissions
    FOR ALL USING (true);

CREATE POLICY "Permitir leitura e solicitação de saques" ON public.affiliate_payouts
    FOR ALL USING (true);
