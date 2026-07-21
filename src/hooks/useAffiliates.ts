import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { affiliateService, type Affiliate } from '../services/affiliateService';

export function useAffiliates() {
    const { user, profile } = useAuth();
    const { currentEntity } = useEntity();
    const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
    const [stats, setStats] = useState<{
        referrals: any[];
        commissions: any[];
        payouts: any[];
        totalReferralsCount: number;
        availableBalance: number;
        pendingBalance: number;
        totalPaidOut: number;
        requestedPayoutBalance: number;
    }>({
        referrals: [],
        commissions: [],
        payouts: [],
        totalReferralsCount: 0,
        availableBalance: 0,
        pendingBalance: 0,
        totalPaidOut: 0,
        requestedPayoutBalance: 0
    });
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const aff = await affiliateService.getOrCreateAffiliate(
                user.id,
                currentEntity.id,
                profile?.full_name || user.user_metadata?.full_name
            );

            setAffiliate(aff);

            if (aff) {
                const s = await affiliateService.getAffiliateStats(aff.id);
                setStats(s);
            }
        } catch (err) {
            console.error('Erro no hook useAffiliates:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, currentEntity.id, profile?.full_name]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const updatePixKey = async (pixKey: string, pixKeyType: string) => {
        if (!affiliate) return false;
        const ok = await affiliateService.updateAffiliate(affiliate.id, {
            pix_key: pixKey,
            pix_key_type: pixKeyType
        });
        if (ok) {
            setAffiliate(prev => prev ? { ...prev, pix_key: pixKey, pix_key_type: pixKeyType } : null);
        }
        return ok;
    };

    const requestPayout = async (amount: number, pixKey: string, method: 'pix' | 'invoice_discount' = 'pix') => {
        if (!affiliate) return { success: false, message: 'Afiliado não encontrado.' };
        const res = await affiliateService.requestPayout(affiliate.id, amount, pixKey, method);
        if (res.success) {
            await loadData();
        }
        return res;
    };

    const referralLink = affiliate?.code
        ? `${window.location.origin}/login?ref=${affiliate.code}`
        : '';

    return {
        affiliate,
        stats,
        loading,
        referralLink,
        refresh: loadData,
        updatePixKey,
        requestPayout
    };
}
