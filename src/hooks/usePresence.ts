import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function usePresence(shouldListen: boolean = false) {
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    useEffect(() => {
        // Don't create channel if no user is authenticated
        if (!user) return;

        const channel = supabase.channel('system_presence', {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        // Track this user's presence
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({
                    user_id: user.id,
                    online_at: new Date().toISOString(),
                });
            }
            if (status === 'CHANNEL_ERROR') {
                console.warn('Presence channel error - will retry automatically');
            }
        });

        // If this component wants to know about others (e.g. Admin)
        if (shouldListen) {
            channel.on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const userIds = Object.values(state)
                    .flat()
                    .map((data: any) => data.user_id)
                    .filter(Boolean);

                const uniqueIds = [...new Set(userIds)];
                setOnlineUsers(uniqueIds as string[]);
            });
        }

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, shouldListen]);

    return { onlineUsers };
}
