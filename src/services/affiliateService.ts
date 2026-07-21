import { supabase, withRetry } from '../lib/supabase';

export interface Affiliate {
    id: string;
    user_id: string;
    company_id?: string;
    code: string;
    reward_type: 'percentage' | 'fixed' | 'credit_only';
    reward_value: number;
    recurring_mode: 'lifetime' | 'first_payment' | 'limited_months';
    limited_months?: number;
    holding_days: number;
    pix_key?: string;
    pix_key_type?: string;
    bank_info?: any;
    status: 'active' | 'suspended';
    created_at: string;
    updated_at: string;
}

export interface Referral {
    id: string;
    affiliate_id: string;
    referred_company_id?: string;
    referred_user_id?: string;
    attribution_code: string;
    status: 'active' | 'canceled';
    created_at: string;
    referred_company?: any;
    referred_profile?: any;
}

export interface AffiliateCommission {
    id: string;
    affiliate_id: string;
    referral_id: string;
    charge_id?: string;
    gross_amount: number;
    commission_rate_applied: number;
    commission_type_applied: 'percentage' | 'fixed';
    commission_amount: number;
    status: 'pending' | 'available' | 'paid' | 'canceled';
    payment_date: string;
    available_at: string;
    created_at: string;
    referral?: Referral;
}

export interface AffiliatePayout {
    id: string;
    affiliate_id: string;
    amount: number;
    payout_method: 'pix' | 'invoice_discount';
    pix_key_used?: string;
    status: 'requested' | 'processing' | 'completed' | 'rejected';
    notes?: string;
    receipt_url?: string;
    processed_at?: string;
    created_at: string;
    affiliate?: Affiliate;
}

export const affiliateService = {
    /**
     * Busca ou gera automaticamente o registro de Afiliado para o usuário/empresa logado
     */
    getOrCreateAffiliate: async (userId: string, companyId?: string, userFullName?: string): Promise<Affiliate | null> => {
        try {
            // 1. Tenta buscar existente por user_id ou company_id
            let query = supabase.from('affiliates').select('*');
            if (companyId && companyId !== 'personal') {
                query = query.eq('company_id', companyId);
            } else {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await withRetry(() => query.maybeSingle());
            if (error) throw error;
            if (data) return data as Affiliate;

            // 2. Se não existir, gera um código único curto (ex: CLETON84 ou LC-8392)
            const sanitizedName = (userFullName || 'PARCEIRO')
                .toUpperCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^A-Z0-9]/g, '')
                .substring(0, 8);
            
            const randomDigits = Math.floor(100 + Math.random() * 900);
            const generatedCode = `${sanitizedName || 'LC'}${randomDigits}`;

            const newAffiliate = {
                user_id: userId,
                company_id: (companyId && companyId !== 'personal') ? companyId : null,
                code: generatedCode,
                reward_type: 'percentage',
                reward_value: 15.00,
                recurring_mode: 'lifetime',
                holding_days: 15,
                status: 'active'
            };

            const { data: created, error: createErr } = await supabase
                .from('affiliates')
                .insert([newAffiliate])
                .select('*')
                .single();

            if (createErr) {
                console.warn('Fallback: criando afiliado com código alternativo...', createErr);
                const fallbackCode = `REF${Date.now().toString().slice(-6)}`;
                const { data: fallbackCreated } = await supabase
                    .from('affiliates')
                    .insert([{ ...newAffiliate, code: fallbackCode }])
                    .select('*')
                    .single();
                return fallbackCreated as Affiliate;
            }

            return created as Affiliate;
        } catch (err) {
            console.error('Erro em getOrCreateAffiliate:', err);
            return null;
        }
    },

    /**
     * Atualiza dados cadastrais do Afiliado (Chave Pix, código customizado, etc)
     */
    updateAffiliate: async (affiliateId: string, updates: Partial<Affiliate>): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('affiliates')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', affiliateId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Erro ao atualizar afiliado:', err);
            return false;
        }
    },

    /**
     * Processa vínculo de indicação ao se cadastrar
     */
    registerReferral: async (attributionCode: string, referredUserId: string, referredCompanyId?: string): Promise<boolean> => {
        try {
            if (!attributionCode) return false;
            
            // Busca o afiliado dono do código
            const { data: affiliate } = await supabase
                .from('affiliates')
                .select('id, user_id, company_id')
                .eq('code', attributionCode.trim().toUpperCase())
                .eq('status', 'active')
                .maybeSingle();

            if (!affiliate) return false;

            // Evita auto-indicação
            if (affiliate.user_id === referredUserId) {
                console.warn('Auto-indicação detectada e bloqueada.');
                return false;
            }

            const { error } = await supabase
                .from('referrals')
                .insert([{
                    affiliate_id: affiliate.id,
                    referred_user_id: referredUserId,
                    referred_company_id: referredCompanyId || null,
                    attribution_code: attributionCode.trim().toUpperCase(),
                    status: 'active'
                }]);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Erro ao registrar indicação:', err);
            return false;
        }
    },

    /**
     * Busca estatísticas agregadas do Afiliado para a UI do Cliente
     */
    getAffiliateStats: async (affiliateId: string) => {
        try {
            // 1. Busca indicados
            const { data: referrals } = await withRetry(() => supabase
                .from('referrals')
                .select(`
                    *,
                    referred_company:companies(id, trade_name, legal_name, created_at, status),
                    referred_profile:profiles!referred_user_id(id, full_name, email)
                `)
                .eq('affiliate_id', affiliateId)
                .order('created_at', { ascending: false })
            );

            // 2. Busca comissões
            const { data: commissions } = await withRetry(() => supabase
                .from('affiliate_commissions')
                .select('*')
                .eq('affiliate_id', affiliateId)
                .order('created_at', { ascending: false })
            );

            // 3. Busca saques
            const { data: payouts } = await withRetry(() => supabase
                .from('affiliate_payouts')
                .select('*')
                .eq('affiliate_id', affiliateId)
                .order('created_at', { ascending: false })
            );

            const allCommissions = commissions || [];
            const allPayouts = payouts || [];

            // Transitar pendentes que passaram da data de maturação
            const now = new Date().toISOString();
            const availableCommissions = allCommissions.filter(c => 
                c.status === 'available' || (c.status === 'pending' && c.available_at <= now)
            );
            const pendingCommissions = allCommissions.filter(c => 
                c.status === 'pending' && c.available_at > now
            );

            const totalAvailableAmount = availableCommissions.reduce((acc, c) => acc + (Number(c.commission_amount) || 0), 0);
            const totalPendingAmount = pendingCommissions.reduce((acc, c) => acc + (Number(c.commission_amount) || 0), 0);
            
            const completedPayouts = allPayouts.filter(p => p.status === 'completed');
            const totalPaidOutAmount = completedPayouts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

            const requestedPayouts = allPayouts.filter(p => p.status === 'requested' || p.status === 'processing');
            const totalRequestedPayout = requestedPayouts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

            // Saldo líquido sacável atual
            const netAvailableForPayout = Math.max(0, totalAvailableAmount - totalPaidOutAmount - totalRequestedPayout);

            return {
                referrals: referrals || [],
                commissions: allCommissions,
                payouts: allPayouts,
                totalReferralsCount: (referrals || []).length,
                availableBalance: netAvailableForPayout,
                pendingBalance: totalPendingAmount,
                totalPaidOut: totalPaidOutAmount,
                requestedPayoutBalance: totalRequestedPayout
            };
        } catch (err) {
            console.error('Erro ao buscar estatísticas do afiliado:', err);
            return {
                referrals: [],
                commissions: [],
                payouts: [],
                totalReferralsCount: 0,
                availableBalance: 0,
                pendingBalance: 0,
                totalPaidOut: 0,
                requestedPayoutBalance: 0
            };
        }
    },

    /**
     * Solicitar Saque Pix ou Crédito
     */
    requestPayout: async (affiliateId: string, amount: number, pixKey: string, payoutMethod: 'pix' | 'invoice_discount' = 'pix'): Promise<{ success: boolean; message: string }> => {
        try {
            if (amount <= 0) return { success: false, message: 'O valor do saque deve ser maior que zero.' };

            const stats = await affiliateService.getAffiliateStats(affiliateId);
            if (amount > stats.availableBalance) {
                return { success: false, message: `Saldo insuficiente. Disponível para saque: R$ ${stats.availableBalance.toFixed(2)}` };
            }

            const { error } = await supabase
                .from('affiliate_payouts')
                .insert([{
                    affiliate_id: affiliateId,
                    amount,
                    payout_method: payoutMethod,
                    pix_key_used: pixKey,
                    status: 'requested'
                }]);

            if (error) throw error;
            return { success: true, message: 'Solicitação de saque efetuada com sucesso! Aguarde o processamento do pagamento.' };
        } catch (err: any) {
            console.error('Erro ao solicitar saque:', err);
            return { success: false, message: err.message || 'Falha ao solicitar saque.' };
        }
    },

    // ==========================================
    // MÉTODOS DO SUPER ADMIN (Dono do Sistema)
    // ==========================================

    /**
     * Busca todos os afiliados cadastrados para o Painel Admin
     */
    getAllAffiliatesAdmin: async () => {
        try {
            const { data, error } = await withRetry(() => supabase
                .from('affiliates')
                .select(`
                    *,
                    company:companies(id, trade_name, legal_name, cnpj),
                    profile:profiles!user_id(id, full_name, email, phone)
                `)
                .order('created_at', { ascending: false })
            );

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Erro em getAllAffiliatesAdmin:', err);
            return [];
        }
    },

    /**
     * Atualiza regras customizadas de um afiliado (Admin)
     */
    updateAffiliateAdmin: async (affiliateId: string, rules: {
        reward_type: 'percentage' | 'fixed' | 'credit_only';
        reward_value: number;
        recurring_mode: 'lifetime' | 'first_payment' | 'limited_months';
        limited_months?: number;
        holding_days: number;
        status: 'active' | 'suspended';
        code?: string;
    }): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('affiliates')
                .update({
                    ...rules,
                    updated_at: new Date().toISOString()
                })
                .eq('id', affiliateId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Erro ao atualizar regras do afiliado:', err);
            return false;
        }
    },

    /**
     * Busca fila de saques solicitados para o Admin
     */
    getPayoutsQueueAdmin: async () => {
        try {
            const { data, error } = await withRetry(() => supabase
                .from('affiliate_payouts')
                .select(`
                    *,
                    affiliate:affiliates(
                        id,
                        code,
                        reward_type,
                        reward_value,
                        pix_key,
                        pix_key_type,
                        company:companies(trade_name, legal_name),
                        profile:profiles!user_id(full_name, email, phone)
                    )
                `)
                .order('created_at', { ascending: false })
            );

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Erro ao buscar fila de saques:', err);
            return [];
        }
    },

    /**
     * Processa aprovação / recusa de saque pelo Admin
     */
    processPayoutAdmin: async (payoutId: string, status: 'completed' | 'rejected', receiptUrl?: string, notes?: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('affiliate_payouts')
                .update({
                    status,
                    receipt_url: receiptUrl || null,
                    notes: notes || null,
                    processed_at: new Date().toISOString()
                })
                .eq('id', payoutId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Erro ao processar saque:', err);
            return false;
        }
    }
};
