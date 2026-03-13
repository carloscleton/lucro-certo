import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface AdminStats {
    total_users: number;
    total_companies: number;
    total_revenue: number;
    total_commission: number;
}

export interface BIStats {
    revenue_series: any[];
    growth_series: any[];
    plan_distribution: any[];
}

export interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    user_type: string;
    created_at: string;
    quotes_count: number;
    transactions_count: number;
    max_companies: number;
    status: string;
}

export interface AdminCompany {
    id: string;
    trade_name: string;
    legal_name: string;
    cnpj: string;
    owner_name: string;
    owner_email: string;
    members_count: number;
    fiscal_module_enabled: boolean;
    payments_module_enabled: boolean;
    crm_module_enabled: boolean;
    settings?: any;
    logo_url?: string;
    created_at: string;
    total_revenue: number;
    commission_earned: number;
    monthly_fee: number;
    annual_fee: number;
    license_expires_at?: string;
    has_social_copilot?: boolean;
    automations_module_enabled?: boolean;
    has_lead_radar?: boolean;
    allowed_entity_types?: string[];
    status: string;
    subscription_plan?: string;
    subscription_status?: string;
    current_period_end?: string;
    trial_ends_at?: string;
    next_billing_value?: number;
}

export function useAdmin() {
    const { user } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [biStats, setBiStats] = useState<BIStats | null>(null);
    const [usersList, setUsersList] = useState<AdminUser[]>([]);
    const [companiesList, setCompaniesList] = useState<AdminCompany[]>([]);
    const [appSettings, setAppSettings] = useState<{
        storage_provider: 'supabase' | 'r2';
        platform_billing_provider?: 'asaas' | 'stripe' | 'mercadopago';
        platform_asaas_api_key?: string;
        platform_stripe_api_key?: string;
        platform_stripe_publishable_key?: string;
        platform_mercadopago_api_key?: string;
        platform_mercadopago_public_key?: string;
        platform_billing_sandbox?: boolean;
        platform_asaas_wallet_id?: string;
        platform_whatsapp_instance?: string;
        billing_notifications_enabled?: boolean;
        billing_whatsapp_template?: string;
        billing_email_template?: string;
        billing_days_before_reminder?: number[];
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ALLOWED_EMAIL = 'carloscleton.nat@gmail.com';
    const isAdmin = user?.email === ALLOWED_EMAIL;

    const fetchAdminData = async (silent = false) => {
        if (!isAdmin) return;

        if (!silent) setLoading(true);
        setError(null);
        try {
            // Fetch Stats
            const { data: statsData, error: statsError } = await supabase
                .rpc('get_admin_stats');

            if (statsError) throw statsError;
            setStats(statsData);

            // Fetch BI Stats
            const { data: biData, error: biError } = await supabase
                .rpc('get_admin_bi_stats');

            if (!biError && biData) {
                setBiStats(biData);
            }

            // Fetch Users List
            const { data: usersData, error: usersError } = await supabase
                .rpc('get_admin_users_list');

            if (usersError) throw usersError;
            setUsersList(usersData || []);

            // Fetch Companies List
            const { data: companiesData, error: companiesError } = await supabase
                .rpc('get_admin_companies_list');

            if (companiesError) throw companiesError;
            setCompaniesList(companiesData || []);

            // Fetch App Settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .maybeSingle();

            if (!settingsError && settingsData) {
                setAppSettings(settingsData as any);
            }

        } catch (err: any) {
            console.error('Error fetching admin data:', err);
            setError(err.message || 'Falha ao carregar dados administrativos');
        } finally {
            if (!silent) setLoading(false);
        }
    };
    const updateCompanyConfig = async (companyId: string, fiscal: boolean, payments: boolean, crm: boolean, marketing: boolean, automations: boolean, leadRadar: boolean, allowedTypes: string[], settings?: any) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        console.log('Updating Company Config:', { companyId, fiscal, payments, crm, marketing, allowedTypes, settings });

        try {
            const { data, error } = await supabase.rpc('admin_update_company_config', {
                target_company_id: companyId,
                fiscal_enabled: fiscal,
                payments_enabled: payments,
                crm_enabled: crm,
                marketing_enabled: marketing,
                automations_enabled: automations,
                lead_radar_enabled: leadRadar,
                allowed_types: allowedTypes,
                settings_input: settings
            });

            if (error) throw error;

            // The RPC returns jsonb_build_object('success', true/false, 'message', string)
            if (data && data.success === false) {
                console.error('RPC Update Failed:', data.message);
                return { error: data.message || 'Erro ao atualizar configuração no servidor' };
            }

            console.log('Update Success! Refreshing data...');
            await fetchAdminData(true);
            return { error: null };
        } catch (err: any) {
            console.error('Error updating company config:', err);
            return { error: err.message };
        }
    };

    const deleteUser = async (userId: string) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        try {
            const { error } = await supabase.rpc('admin_delete_user', {
                target_user_id: userId
            });

            if (error) throw error;

            // Refresh list
            await fetchAdminData(true);
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting user:', err);
            return { error: err.message };
        }
    };

    const toggleUserBan = async (userId: string, shouldBan: boolean) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        // Optimistic Update
        const previousList = [...usersList];
        setUsersList(usersList.map(u =>
            u.id === userId
                ? { ...u, banned_until: shouldBan ? '9999-12-31T23:59:59Z' : null }
                : u
        ));

        try {
            const { error } = await supabase.rpc('admin_toggle_user_ban', {
                target_user_id: userId,
                should_ban: shouldBan
            });

            if (error) throw error;

            // Refresh list silently to ensure consistency
            await fetchAdminData(true);
            return { error: null };
        } catch (err: any) {
            console.error('Error toggling user ban:', err);
            // Revert optimistic update
            setUsersList(previousList);
            return { error: err.message };
        }
    };

    const toggleCompanyBlock = async (companyId: string, shouldBlock: boolean) => {
        console.log('toggleCompanyBlock called:', { companyId, shouldBlock });
        if (!isAdmin) return { error: 'Unauthorized' };

        // Optimistic Update
        const previousList = [...companiesList];
        setCompaniesList(companiesList.map(c =>
            c.id === companyId
                ? { ...c, status: shouldBlock ? 'blocked' : 'active' }
                : c
        ));

        try {
            const { error } = await supabase.rpc('admin_toggle_company_status', {
                target_company_id: companyId,
                should_block: shouldBlock
            });

            if (error) throw error;
            await fetchAdminData(true);
            return { error: null };
        } catch (err: any) {
            console.error('Error toggling company status:', err);
            setCompaniesList(previousList);
            return { error: err.message };
        }
    };

    const manualRenewSubscription = async (companyId: string) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        try {
            const { error } = await supabase
                .from('companies')
                .update({
                    subscription_status: 'active',
                    subscription_plan: 'pro',
                    status: 'active',
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                })
                .eq('id', companyId);

            if (error) throw error;
            await fetchAdminData(true);
            return { error: null };
        } catch (err: any) {
            console.error('Error renewing subscription:', err);
            return { error: err.message };
        }
    };

    const setCompanyTrial = async (companyId: string, days: number = 7) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        try {
            const { error } = await supabase
                .from('companies')
                .update({
                    subscription_status: 'active',
                    subscription_plan: 'trial',
                    trial_ends_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
                })
                .eq('id', companyId);

            if (error) throw error;
            await fetchAdminData(true);
            return { error: null };
        } catch (err: any) {
            console.error('Error setting trial:', err);
            return { error: err.message };
        }
    };

    const updateUserLimit = async (userId: string, newLimit: number) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        try {
            const { error } = await supabase.rpc('admin_update_user_limit', {
                target_user_id: userId,
                new_limit: newLimit
            });

            if (error) throw error;
            await fetchAdminData(true);
            return { error: null };
        } catch (err: any) {
            console.error('Error updating user limit:', err);
            return { error: err.message };
        }
    };

    const updateUserConfig = async (userId: string, settings: any) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        try {
            const { error } = await supabase.rpc('admin_update_user_config', {
                target_user_id: userId,
                settings_input: settings
            });

            if (error) throw error;
            await fetchAdminData(true);
            return { error: null };
        } catch (err: any) {
            console.error('Error updating user config:', err);
            return { error: err.message };
        }
    };

    const updateAppSettings = async (newSettings: Partial<{
        storage_provider: 'supabase' | 'r2';
        platform_billing_provider: 'asaas' | 'stripe' | 'mercadopago';
        platform_asaas_api_key: string;
        platform_stripe_api_key: string;
        platform_stripe_publishable_key: string;
        platform_mercadopago_api_key: string;
        platform_mercadopago_public_key: string;
        platform_billing_sandbox: boolean;
        platform_asaas_wallet_id: string;
        platform_whatsapp_instance: string;
        billing_notifications_enabled: boolean;
        billing_whatsapp_template: string;
        billing_email_template: string;
        billing_days_before_reminder: number[];
    }>) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        try {
            const { error } = await supabase
                .from('app_settings')
                .update(newSettings)
                .eq('id', 1);

            if (error) throw error;

            setAppSettings(prev => prev ? { ...prev, ...newSettings } : newSettings as any);
            return { error: null };
        } catch (err: any) {
            console.error('Error updating app settings:', err);
            return { error: err.message };
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchAdminData();
        } else {
            // Limpa dados administrativos se não for admin
            setStats(null);
            setUsersList([]);
            setCompaniesList([]);
        }
    }, [user, isAdmin]);

    return {
        isAdmin,
        stats,
        usersList,
        companiesList,
        loading,
        error,
        deleteUser,
        toggleUserBan,
        toggleCompanyBlock,
        updateUserLimit,
        updateUserConfig,
        updateCompanyConfig,
        updateAppSettings,
        manualRenewSubscription,
        setCompanyTrial,
        biStats,
        appSettings,
        refresh: fetchAdminData
    };
}
