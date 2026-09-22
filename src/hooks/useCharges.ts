import { useState, useEffect, useCallback } from 'react';
import { supabase, withRetry } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
import { API_BASE_URL } from '../lib/constants';
import axios from 'axios';

export interface Charge {
    id: string;
    company_id: string;
    customer_id?: string;
    provider: string;
    amount: number;
    description: string;
    external_reference: string;
    payment_method: string;
    status: 'pending' | 'approved' | 'paid' | 'cancelled' | 'rejected';
    gateway_id?: string;
    payment_link?: string;
    qr_code?: string;
    qr_code_base64?: string;
    is_sandbox: boolean;
    quote_id?: string;
    currency?: string;
    paid_at?: string;
    payment_date?: string;
    due_date?: string;
    paid_amount?: number;
    interest_amount?: number;
    created_at: string;
    updated_at?: string;
    customer?: {
        name: string;
    };
}

const chargesCache = new Map<string, Charge[]>();

export function useCharges() {
    const { currentEntity } = useEntity();
    const cacheKey = currentEntity?.id || 'none';
    const cached = chargesCache.get(cacheKey);

    const [charges, setCharges] = useState<Charge[]>(cached || []);
    const [loading, setLoading] = useState(!cached);

    const fetchCharges = useCallback(async (silent = false) => {
        if (!currentEntity || currentEntity.type !== 'company' || !currentEntity.id) {
            setCharges([]);
            setLoading(false);
            return;
        }

        if (!chargesCache.has(cacheKey) && !silent) {
            setLoading(true);
        }
        try {
            const { data, error } = await withRetry(() => supabase
                .from('company_charges')
                .select(`
                    *,
                    customer:contacts(name)
                `)
                .eq('company_id', currentEntity.id)
                .order('created_at', { ascending: false }));

            if (error) throw error;
            const res = data || [];
            chargesCache.set(cacheKey, res);
            setCharges(res);
        } catch (error) {
            const errStr = String((error as any)?.message || error);
            if (!errStr.includes('Failed to fetch')) {
                console.error('Error fetching charges:', error);
            }
        } finally {
            setLoading(false);
        }
    }, [currentEntity?.id, currentEntity?.type, cacheKey]);

    useEffect(() => {
        const hasCache = chargesCache.has(cacheKey);
        fetchCharges(hasCache);

        if (!currentEntity || currentEntity.type !== 'company' || !currentEntity.id) return;

        const channel = supabase
            .channel(`company_charges_changes_${currentEntity.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'company_charges',
                    filter: `company_id=eq.${currentEntity.id}`
                },
                () => {
                    fetchCharges(true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchCharges, currentEntity?.id, currentEntity?.type, cacheKey]);

    const createCharge = async (params: {
        provider: string,
        config: any,
        is_sandbox: boolean,
        customerId?: string,
        quoteId?: string,
        payload: {
            amount: number,
            description: string,
            due_date?: string,
            currency?: string,
            customer: {
                name: string,
                email: string,
                tax_id?: string
            },
            payment_method?: string,
            fine?: { value: number; type?: 'PERCENTAGE' | 'FIXED' },
            interest?: { value: number },
            discount?: { value: number; dueDateLimitDays?: number; type?: 'PERCENTAGE' | 'FIXED' },
            instructions?: string
        }
    }) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const response = await axios.post(`${API_BASE_URL}/payments/create`, {
                companyId: currentEntity.id,
                ...params
            }, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (response.data.success) {
                await fetchCharges();
            }

            return response.data;
        } catch (error) {
            console.error('Error creating charge:', error);
            throw error;
        }
    };

    const deleteCharge = async (id: string) => {
        try {
            const { error } = await supabase
                .from('company_charges')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchCharges();
            return { success: true };
        } catch (error: any) {
            console.error('Error deleting charge:', error);
            return { success: false, error: error.message };
        }
    };

    const deleteMultipleCharges = async (ids: string[]) => {
        if (!ids || ids.length === 0) return { success: true };
        try {
            const { error } = await supabase
                .from('company_charges')
                .delete()
                .in('id', ids);

            if (error) throw error;
            await fetchCharges();
            return { success: true };
        } catch (error: any) {
            console.error('Error deleting multiple charges:', error);
            return { success: false, error: error.message };
        }
    };

    return {
        charges,
        loading,
        fetchCharges,
        createCharge,
        deleteCharge,
        deleteMultipleCharges
    };
}
