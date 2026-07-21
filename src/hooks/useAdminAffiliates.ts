import { useState, useEffect, useCallback } from 'react';
import { affiliateService } from '../services/affiliateService';

export function useAdminAffiliates() {
    const [affiliates, setAffiliates] = useState<any[]>([]);
    const [payoutsQueue, setPayoutsQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAdminData = useCallback(async () => {
        try {
            setLoading(true);
            const [affs, payouts] = await Promise.all([
                affiliateService.getAllAffiliatesAdmin(),
                affiliateService.getPayoutsQueueAdmin()
            ]);
            setAffiliates(affs);
            setPayoutsQueue(payouts);
        } catch (err) {
            console.error('Erro no hook useAdminAffiliates:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAdminData();
    }, [loadAdminData]);

    const updateRules = async (affiliateId: string, rules: any) => {
        const ok = await affiliateService.updateAffiliateAdmin(affiliateId, rules);
        if (ok) {
            await loadAdminData();
        }
        return ok;
    };

    const processPayout = async (payoutId: string, status: 'completed' | 'rejected', receiptUrl?: string, notes?: string) => {
        const ok = await affiliateService.processPayoutAdmin(payoutId, status, receiptUrl, notes);
        if (ok) {
            await loadAdminData();
        }
        return ok;
    };

    const totalRequestedPayouts = payoutsQueue
        .filter(p => p.status === 'requested')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    const totalCompletedPayouts = payoutsQueue
        .filter(p => p.status === 'completed')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    return {
        affiliates,
        payoutsQueue,
        totalRequestedPayouts,
        totalCompletedPayouts,
        loading,
        refresh: loadAdminData,
        updateRules,
        processPayout
    };
}
