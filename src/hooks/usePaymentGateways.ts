import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
import { API_BASE_URL } from '../lib/constants';
import axios from 'axios';

export interface PaymentGateway {
    id: string;
    company_id: string;
    provider: 'mercado_pago' | 'stripe' | 'asaas';
    is_active: boolean;
    is_sandbox: boolean;
    config: Record<string, any>;
    webhook_secret?: string;
    last_verified_at?: string;
    created_at?: string;
}

// Cache global para preservar dados entre trocas de aba e evitar recarregamento visual
const globalGatewaysCache: Record<string, PaymentGateway[]> = {};
const globalLoadingCache: Record<string, boolean> = {};

export function usePaymentGateways() {
    const { currentEntity } = useEntity();
    const entityId = currentEntity?.id || 'none';

    const [gateways, setGateways] = useState<PaymentGateway[]>(globalGatewaysCache[entityId] || []);
    const [loading, setLoading] = useState<boolean>(globalLoadingCache[entityId] !== false && !globalGatewaysCache[entityId]);

    const fetchGateways = useCallback(async (silent = false) => {
        if (!currentEntity || currentEntity.type !== 'company' || !currentEntity.id) {
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
        try {
            const { data, error } = await supabase
                .from('company_payment_gateways')
                .select('*')
                .eq('company_id', currentEntity.id);

            if (error) throw error;
            
            const fetchedData = data || [];
            setGateways(fetchedData);
            globalGatewaysCache[currentEntity.id] = fetchedData;
            globalLoadingCache[currentEntity.id] = false;
        } catch (error) {
            console.error('Error fetching payment gateways:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [currentEntity]);

    useEffect(() => {
        const hasCache = !!globalGatewaysCache[entityId];
        fetchGateways(hasCache);
    }, [fetchGateways, entityId]);

    const saveGateway = async (gatewayData: Omit<PaymentGateway, 'id' | 'company_id'>) => {
        if (!currentEntity || currentEntity.type !== 'company') return { error: 'Not in company context' };

        try {
            const { data, error } = await supabase
                .from('company_payment_gateways')
                .upsert({
                    company_id: currentEntity.id,
                    ...gatewayData
                }, {
                    onConflict: 'company_id,provider'
                })
                .select()
                .single();

            if (error) throw error;
            await fetchGateways();
            return { data, error: null };
        } catch (error) {
            console.error('Error saving payment gateway:', error);
            return { error };
        }
    };

    const toggleGateway = async (id: string, is_active: boolean) => {
        try {
            const { error } = await supabase
                .from('company_payment_gateways')
                .update({ is_active })
                .eq('id', id);

            if (error) throw error;
            await fetchGateways();
            return { error: null };
        } catch (error) {
            console.error('Error toggling payment gateway:', error);
            return { error };
        }
    };

    const deleteGateway = async (id: string) => {
        try {
            const { error } = await supabase
                .from('company_payment_gateways')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchGateways();
            return { error: null };
        } catch (error) {
            console.error('Error deleting payment gateway:', error);
            return { error };
        }
    };

    const testConnection = async (provider: string, config: any, is_sandbox: boolean) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await axios.post(`${API_BASE_URL}/payments/test-connection`, {
                provider,
                config,
                is_sandbox
            }, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            return response.data;
        } catch (error: any) {
            console.error('Error testing connection:', error);
            return { success: false, message: error.response?.data?.message || error.message || 'Erro de conexão.' };
        }
    };

    return {
        gateways,
        loading,
        saveGateway,
        toggleGateway,
        deleteGateway,
        testConnection,
        refresh: fetchGateways
    };
}
