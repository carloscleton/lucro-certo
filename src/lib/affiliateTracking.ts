const STORAGE_KEY = 'lucro_certo_ref_code';
const EXPIRY_DAYS = 30;

export interface StoredRef {
    code: string;
    timestamp: number;
}

/**
 * Captura o parâmetro ?ref=CODIGO da URL e salva no localStorage
 */
export function captureReferralFromURL(): string | null {
    if (typeof window === 'undefined') return null;

    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref') || urlParams.get('r');

    if (refCode && refCode.trim()) {
        const cleaned = refCode.trim().toUpperCase();
        const payload: StoredRef = {
            code: cleaned,
            timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        return cleaned;
    }

    return getStoredReferralCode();
}

/**
 * Retorna o código de indicação armazenado no localStorage se ainda for válido
 */
export function getStoredReferralCode(): string | null {
    if (typeof window === 'undefined') return null;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
        const parsed: StoredRef = JSON.parse(stored);
        const maxAge = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        
        if (Date.now() - parsed.timestamp > maxAge) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }

        return parsed.code;
    } catch {
        // Se for string pura antiga
        return stored.trim().toUpperCase();
    }
}

/**
 * Remove o código de indicação após a conclusão do cadastro
 */
export function clearStoredReferralCode(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}
