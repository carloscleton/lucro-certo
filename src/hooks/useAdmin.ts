import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface AdminStats {
    total_users: number;
    total_companies: number;
    total_revenue: number;
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
export function useAdmin() {
    const { user } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [usersList, setUsersList] = useState<AdminUser[]>([]);
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

        } catch (err: any) {
            console.error('Error fetching admin data:', err);
            setError(err.message || 'Falha ao carregar dados administrativos');
        } finally {
            if (!silent) setLoading(false);
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

    useEffect(() => {
        if (isAdmin) {
            fetchAdminData();
        }
    }, [user, isAdmin]);

    return {
        isAdmin,
        stats,
        usersList,
        loading,
        error,
        deleteUser,
        toggleUserBan,
        updateUserLimit,
        refresh: fetchAdminData
    };
}
