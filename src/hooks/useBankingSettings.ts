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

// Cache global para preservar dados entre trocas de aba e evitar recarregamento visual
const globalConfigsCache: Record<string, BankingConfig[]> = {};
const globalLoadingCache: Record<string, boolean> = {};

const SENSITIVE_PEM_FIELDS = ['certificate_pem', 'private_key_pem', 'private_key'];

export function encodeBankingConfig(config: Record<string, any>): Record<string, any> {
    if (!config) return {};
    const encoded = { ...config };
    for (const key of SENSITIVE_PEM_FIELDS) {
        if (typeof encoded[key] === 'string' && encoded[key].trim()) {
            const val = encoded[key].trim();
            if (!val.startsWith('base64:')) {
                encoded[key] = 'base64:' + btoa(unescape(encodeURIComponent(val)));
            }
        }
    }
    return encoded;
}

export function decodeBankingConfig(config: Record<string, any>): Record<string, any> {
    if (!config) return {};
    const decoded = { ...config };
    for (const key of SENSITIVE_PEM_FIELDS) {
        if (typeof decoded[key] === 'string' && decoded[key].startsWith('base64:')) {
            try {
                const base64Str = decoded[key].substring(7);
                decoded[key] = decodeURIComponent(escape(atob(base64Str)));
            } catch (err) {
                console.error('Error decoding config field ' + key + ':', err);
            }
        }
    }
    return decoded;
}

export function useBankingSettings() {
    const { currentEntity } = useEntity();
    const entityId = currentEntity?.id || 'none';

    const [configs, setConfigs] = useState<BankingConfig[]>(globalConfigsCache[entityId] || []);
    const [loading, setLoading] = useState<boolean>(globalLoadingCache[entityId] !== false && !globalConfigsCache[entityId]);

    const fetchConfigs = useCallback(async (silent = false) => {
        if (!currentEntity || currentEntity.type !== 'company' || !currentEntity.id) {
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
        try {
            const { data, error } = await supabase
                .from('company_banking_configs')
                .select('*')
                .eq('company_id', currentEntity.id);

            if (error) throw error;
            const fetchedData = (data || []).map(item => ({
                ...item,
                config: decodeBankingConfig(item.config)
            }));
            setConfigs(fetchedData);
            globalConfigsCache[currentEntity.id] = fetchedData;
            globalLoadingCache[currentEntity.id] = false;
        } catch (error) {
            console.error('Error fetching banking configs:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [currentEntity]);

    useEffect(() => {
        const hasCache = !!globalConfigsCache[entityId];
        fetchConfigs(hasCache);
    }, [fetchConfigs, entityId]);

    const saveConfig = async (configData: Omit<BankingConfig, 'id' | 'company_id'>) => {
        if (!currentEntity || currentEntity.type !== 'company') return { error: 'Not in company context' };

        try {
            const encodedConfig = encodeBankingConfig(configData.config);
            const { data, error } = await supabase
                .from('company_banking_configs')
                .upsert({
                    company_id: currentEntity.id,
                    ...configData,
                    config: encodedConfig
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
