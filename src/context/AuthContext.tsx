import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import { usePresence } from '../hooks/usePresence';

type UserType = 'PF' | 'PJ';

interface Profile {
    id: string;
    email: string;
    full_name?: string;
    user_type: UserType;
    company_id?: string;
    max_companies?: number;
}

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    signOut: async () => { },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                // Stale session or invalid token is common on load, treat as signed out
                console.log('Session init:', error.message);
                setSession(null);
                setUser(null);
                setLoading(false);
            } else {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) fetchProfile(session.user.id);
                else setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) fetchProfile(session.user.id);
            else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching profile:', error);
            }

            if (data) {
                let companyId: string | undefined;
                try {
                    // Fetch company_id
                    const { data: memberData } = await supabase
                        .from('company_members')
                        .select('company_id')
                        .eq('user_id', userId)
                        .eq('status', 'active')
                        .limit(1)
                        .maybeSingle();

                    if (memberData) companyId = memberData.company_id;
                } catch (memberErr) {
                    console.error('Error fetching company membership:', memberErr);
                }

                setProfile({ ...data, company_id: companyId } as Profile);
            } else {
                console.warn('No profile found for user:', userId);
            }
        } catch (err) {
            console.error('Unexpected error in fetchProfile:', err);
        } finally {
            setLoading(false);
        }
    }

    async function signOut() {
        await supabase.auth.signOut();
    }

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
            <PresenceBroadcaster />
            {children}
        </AuthContext.Provider>
    );
};

// Helper component to use the context from within the provider
const PresenceBroadcaster = () => {
    usePresence(false);
    return null;
};

export const useAuth = () => useContext(AuthContext);
