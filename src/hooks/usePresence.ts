import { useState } from 'react';

/**
 * Hook simplified to disable Supabase Realtime which was causing WebSocket errors.
 * Presence tracking is currently disabled to ensure system stability.
 */
export function usePresence(_shouldListen: boolean = false) {
    // Return empty state to avoid breaking UI components that use this hook
    const [onlineUsers] = useState<string[]>([]);

    // Realtime logic removed to prevent WebSocket connection failures

    return { onlineUsers };
}
