import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key missing. Check your .env file.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Resilient helper to execute Supabase queries with auto-retry for transient network errors (Failed to fetch).
 */
export async function withRetry<T>(
    fn: () => PromiseLike<T>,
    retries = 2,
    delayMs = 400
): Promise<T> {
    try {
        const res = await fn();
        if (res && typeof res === 'object' && 'error' in res && (res as any).error) {
            const err = (res as any).error;
            const errStr = String(err?.message || err?.details || err);
            if ((errStr.includes('Failed to fetch') || errStr.includes('TypeError') || errStr.includes('network')) && retries > 0) {
                await new Promise(r => setTimeout(r, delayMs));
                return withRetry(fn, retries - 1, delayMs * 1.5);
            }
        }
        return res as T;
    } catch (err: any) {
        const errStr = String(err?.message || err?.name || err);
        if ((errStr.includes('Failed to fetch') || errStr.includes('TypeError') || errStr.includes('network')) && retries > 0) {
            await new Promise(r => setTimeout(r, delayMs));
            return withRetry(fn, retries - 1, delayMs * 1.5);
        }
        throw err;
    }
}
