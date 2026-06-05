import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';

export interface BankingConfig {
    id: string;
    company_id: string;
    provider: string;
    is_active: boolean;
    dda_enabled: boolean;
    config: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}

export function useBankingSettings() {
    const { currentEntity } = useEntity();
    const [configs, setConfigs] = useState<BankingConfig[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchConfigs = useCallback(async () => {
        if (!currentEntity || currentEntity.type !== 'company') {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('company_banking_configs')
                .select('*')
                .eq('company_id', currentEntity.id);

            if (error) throw error;
            setConfigs(data || []);
        } catch (error) {
            console.error('Error fetching banking configs:', error);
        } finally {
            setLoading(false);
        }
    }, [currentEntity]);

    useEffect(() => {
        fetchConfigs();
    }, [fetchConfigs]);

    const saveConfig = async (configData: Omit<BankingConfig, 'id' | 'company_id'>) => {
        if (!currentEntity || currentEntity.type !== 'company') return { error: 'Not in company context' };

        try {
            const { data, error } = await supabase
                .from('company_banking_configs')
                .upsert({
                    company_id: currentEntity.id,
                    ...configData
                }, {
                    onConflict: 'company_id,provider'
                })
                .select()
                .single();

            if (error) throw error;
            await fetchConfigs();
            return { data, error: null };
        } catch (error) {
            console.error('Error saving banking config:', error);
            return { error };
        }
    };

    const toggleConfig = async (id: string, is_active: boolean) => {
        try {
            const { error } = await supabase
                .from('company_banking_configs')
                .update({ is_active })
                .eq('id', id);

            if (error) throw error;
            await fetchConfigs();
            return { error: null };
        } catch (error) {
            console.error('Error toggling banking config:', error);
            return { error };
        }
    };

    const deleteConfig = async (id: string) => {
        try {
            const { error } = await supabase
                .from('company_banking_configs')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchConfigs();
            return { error: null };
        } catch (error) {
            console.error('Error deleting banking config:', error);
            return { error };
        }
    };

    const testConnection = async (provider: string, config: any) => {
        // Simulação de teste de conexão para as credenciais bancárias
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const isApi = provider.endsWith('_api') || config.custom_type === 'api';
        
        if (isApi) {
            if (provider === 'inter_api' && (!config.client_id || !config.client_secret)) {
                return { success: false, message: 'Chaves de API Client ID e Client Secret são obrigatórias.' };
            }
            if (provider === 'stark_api' && !config.project_id) {
                return { success: false, message: 'Project ID é obrigatório para Stark Bank.' };
            }
        } else {
            if (!config.branch || !config.account) {
                return { success: false, message: 'Agência e Conta são campos obrigatórios para a integração.' };
            }
        }
        
        return { success: true, message: 'Conexão validada com sucesso (ambiente simulado).' };
    };

    return {
        configs,
        loading,
        saveConfig,
        toggleConfig,
        deleteConfig,
        testConnection,
        refresh: fetchConfigs
    };
}
