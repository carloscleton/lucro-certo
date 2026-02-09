import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
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

export function usePaymentGateways() {
    const { currentEntity } = useEntity();
    const [gateways, setGateways] = useState<PaymentGateway[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGateways = useCallback(async () => {
        if (!currentEntity || currentEntity.type !== 'company') {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('company_payment_gateways')
                .select('*')
                .eq('company_id', currentEntity.id);

            if (error) throw error;
            setGateways(data || []);
        } catch (error) {
            console.error('Error fetching payment gateways:', error);
        } finally {
            setLoading(false);
        }
    }, [currentEntity]);

    useEffect(() => {
        fetchGateways();
    }, [fetchGateways]);

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
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/payments/test-connection`, {
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
