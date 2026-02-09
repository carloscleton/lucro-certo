import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function usePresence(shouldListen: boolean = false) {
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

    useEffect(() => {
        // Defines the channel
        const channel = supabase.channel('system_presence', {
            config: {
                presence: {
                    key: user?.id, // Identify this client by user ID
                },
            },
        });

        // If logged in, track this user's presence
        if (user) {
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });
        }

        // If this component wants to know about others (e.g. Admin)
        if (shouldListen) {
            channel
                .on('presence', { event: 'sync' }, () => {
                    const state = channel.presenceState();
                    // Robustly extract user_ids from the payloads, not just keys
                    const userIds = Object.values(state)
                        .flat()
                        .map((data: any) => data.user_id)
                        .filter(Boolean); // Remove empty/nulls

                    // Remove duplicates
                    const uniqueIds = [...new Set(userIds)];

                    console.log('Online Users (Sync):', uniqueIds);
                    setOnlineUsers(uniqueIds as string[]);
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('Presence Listener Connected');
                    }
                });
        }

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, shouldListen]);

    return { onlineUsers };
}
