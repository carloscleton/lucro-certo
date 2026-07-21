-- Migration: Adicionar dia de pagamento de afiliados às configurações globais
-- Data: 2026-07-21

ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS affiliate_payout_day INTEGER DEFAULT 10;
