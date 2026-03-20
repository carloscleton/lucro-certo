import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 14 * 60 * 1000; // Show warning after 14 minutes

export function useIdleTimeout() {
    const { signOut, user } = useAuth();
    const [isIdle, setIsIdle] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const timerRef = useRef<any>(null);
    const warningTimerRef = useRef<any>(null);

    const resetTimer = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

        setIsIdle(false);
        setShowWarning(false);

        if (user) {
            warningTimerRef.current = setTimeout(() => setShowWarning(true), WARNING_MS);
            timerRef.current = setTimeout(() => {
                setIsIdle(true);
                signOut();
            }, TIMEOUT_MS);
        }
    };

    useEffect(() => {
        const events = ['mousemove', 'mousedown', 'keypress', 'wheel', 'touchstart'];
        
        if (user) {
            resetTimer();
            events.forEach(event => window.addEventListener(event, resetTimer));
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [user]);

    return { isIdle, showWarning, resetTimer };
}
