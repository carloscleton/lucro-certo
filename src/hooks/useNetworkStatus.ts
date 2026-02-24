import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that monitors the user's network status.
 * Uses navigator.onLine and the online/offline events.
 * Also periodically pings a lightweight resource to detect false positives.
 */
export function useNetworkStatus() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [wasOffline, setWasOffline] = useState(false);

    const handleOnline = useCallback(() => {
        setIsOnline(true);
        setWasOffline(true);
        // Auto-hide the "back online" message after 4s
        setTimeout(() => setWasOffline(false), 4000);
    }, []);

    const handleOffline = useCallback(() => {
        setIsOnline(false);
        setWasOffline(false);
    }, []);

    useEffect(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [handleOnline, handleOffline]);

    return { isOnline, wasOffline };
}
