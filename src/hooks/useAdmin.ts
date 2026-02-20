import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface AdminStats {
    total_users: number;
    total_companies: number;
    total_revenue: number;
    total_commission: number;
}

export interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    user_type: string;
    created_at: string;
    quotes_count: number;
    transactions_count: number;
    banned_until?: string | null;
    max_companies: number;
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
}

export function useAdmin() {
    const { user } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [usersList, setUsersList] = useState<AdminUser[]>([]);
    const [companiesList, setCompaniesList] = useState<AdminCompany[]>([]);
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

        } catch (err: any) {
            console.error('Error fetching admin data:', err);
            setError(err.message || 'Falha ao carregar dados administrativos');
        } finally {
            if (!silent) setLoading(false);
        }
    };
    const updateCompanyConfig = async (companyId: string, fiscal: boolean, payments: boolean, crm: boolean, settings?: any) => {
        if (!isAdmin) return { error: 'Unauthorized' };

        console.log('Updating Company Config:', { companyId, fiscal, payments, crm, settings });

        try {
            const { data, error } = await supabase.rpc('admin_update_company_config', {
                target_company_id: companyId,
                fiscal_enabled: fiscal,
                payments_enabled: payments,
                crm_enabled: crm,
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
        updateUserLimit,
        updateUserConfig,
        updateCompanyConfig,
        refresh: fetchAdminData
    };
}
