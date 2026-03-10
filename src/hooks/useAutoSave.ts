import { useEffect } from 'react';

/**
 * Reusable hook to auto-save and restore form state from localStorage.
 * 
 * @param key Unique key for the form (e.g., 'transaction_expense')
 * @param data Object containing all form fields
 * @param setters Object containing all setter functions corresponding to the data keys
 * @param enabled Whether auto-save is active (e.g., only for NEW records, not when editing)
 * @param isOpen Whether the form/modal is currently open
 */
export function useAutoSave(
    key: string,
    data: Record<string, any>,
    setters: Record<string, (val: any) => void>,
    enabled: boolean,
    isOpen: boolean
) {
    // 1. Load data when form opens
    useEffect(() => {
        if (enabled && isOpen) {
            const saved = localStorage.getItem(`autosave_${key}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    Object.entries(parsed).forEach(([k, v]) => {
                        if (setters[k] && v !== undefined && v !== null && v !== '') {
                            setters[k](v);
                        }
                    });
                } catch (e) {
                    console.error('Failed to load auto-save data for', key, e);
                }
            }
        }
    }, [isOpen, key, enabled]); // Intentionally omitting setters to avoid re-runs

    // 2. Save data whenever it changes
    useEffect(() => {
        if (enabled && isOpen) {
            localStorage.setItem(`autosave_${key}`, JSON.stringify(data));
        }
    }, [data, key, enabled, isOpen]);

    // Returns a function to manually clear the cache (useful after successful submit)
    const clearCache = () => {
        localStorage.removeItem(`autosave_${key}`);
    };

    return { clearCache };
}
