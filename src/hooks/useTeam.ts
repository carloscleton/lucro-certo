import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface TeamMember {
    id: string; // membership id
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    status: 'active' | 'invited' | 'inactive';
    profile: {
        full_name: string;
        email: string;
    };
    joined_at: string;
}

export interface TeamInvite {
    id: string;
    email: string;
    role: 'admin' | 'member';
    status: 'pending' | 'expired'; // Derived from logic usually, but here checking table
    created_at: string;
    expires_at: string;
    token: string;
}

export function useTeam() {
    const { user, profile } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [invites, setInvites] = useState<TeamInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const companyId = profile?.company_id;

    const fetchTeam = useCallback(async () => {
        // Try to use profile companyId, or fetch it if missing
        let validCompanyId = companyId;

        if (!validCompanyId) {
            // Attempt to fetch from DB directly
            const { data } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('user_id', user?.id)
                .eq('status', 'active')
                .maybeSingle();

            if (data) validCompanyId = data.company_id;
        }

        // Final Fallback: Auto-heal if still missing
        if (!validCompanyId) {
            const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_company_for_user');
            if (rpcData && !rpcError) {
                validCompanyId = rpcData;
            }
        }

        if (!validCompanyId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch Members
            const { data: membersData, error: membersError } = await supabase
                .from('company_members')
                .select(`
                    id,
                    user_id,
                    role,
                    status,
                    created_at,
                    profile:user_id (
                        full_name,
                        email
                    )
                `)
                .eq('company_id', validCompanyId)
                .eq('status', 'active');

            if (membersError) throw membersError;

            // Map to TeamMember interface
            const formattedMembers = membersData.map((m: any) => ({
                id: m.id,
                user_id: m.user_id,
                role: m.role,
                status: m.status,
                profile: {
                    full_name: m.profile?.full_name || 'Sem nome',
                    email: m.profile?.email || '',
                },
                joined_at: m.created_at,
            }));

            setMembers(formattedMembers);

            // Fetch Invites
            const { data: invitesData, error: invitesError } = await supabase
                .from('team_invites')
                .select('*')
                .eq('company_id', validCompanyId)
                .gt('expires_at', new Date().toISOString()); // Only valid invites

            if (invitesError) throw invitesError;

            setInvites(invitesData || []);

        } catch (err: any) {
            console.error('Error fetching team:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [companyId, user?.id]);

    useEffect(() => {
        fetchTeam();
    }, [fetchTeam]);

    const inviteMember = async (email: string, role: 'admin' | 'member') => {
        // Resolve companyId logic
        let targetCompanyId = companyId;
        if (!targetCompanyId) {
            const { data } = await supabase
                .from('company_members')
                .select('company_id')
                .eq('user_id', user?.id)
                .eq('status', 'active')
                .maybeSingle();
            if (data) targetCompanyId = data.company_id;
        }

        if (!targetCompanyId) {
            // Fallback: Try to "heal" the account using RPC
            const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_company_for_user');
            if (rpcData && !rpcError) {
                targetCompanyId = rpcData;
                // Refresh context in background
                fetchTeam();
            }
        }

        if (!targetCompanyId) return { error: 'No company found (Auto-fix failed)' };

        try {
            // Use RPC to bypass RLS complexity
            const { data, error } = await supabase.rpc('invite_member', {
                target_email: email,
                target_role: role,
                target_company_id: targetCompanyId
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error);

            await fetchTeam();
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err.message };
        }
    };

    const removeMember = async (memberId: string) => {
        try {
            const { error } = await supabase
                .from('company_members')
                .delete()
                .eq('id', memberId);

            if (error) throw error;
            await fetchTeam();
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    };

    const cancelInvite = async (inviteId: string) => {
        try {
            const { error } = await supabase
                .from('team_invites')
                .delete()
                .eq('id', inviteId);

            if (error) throw error;
            await fetchTeam();
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    };

    const copyInviteLink = (token: string) => {
        const link = `${window.location.origin}/accept-invite?token=${token}`;
        navigator.clipboard.writeText(link);
        return link;
    };

    return {
        members,
        invites,
        loading,
        error,
        inviteMember,
        removeMember,
        cancelInvite,
        copyInviteLink,
        refresh: fetchTeam
    };
}
