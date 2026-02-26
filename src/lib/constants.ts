const getApiBaseUrl = () => {
    // 1. Prioridade para variáveis de ambiente explícitas
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

    // 2. Detecção baseada no ambiente do Vite
    // No modo dev (npm run dev), o Vite define import.meta.env.DEV como true.
    if (import.meta.env.DEV) {
        return 'http://localhost:3001';
    }

    // 3. Em produção, usamos o prefixo relativo /api (Vercel)
    return '/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Log para ajudar a depurar o console do usuário
if (import.meta.env.DEV) {
    console.log(`[Vinx System] API pointing to: ${API_BASE_URL}`);
}
