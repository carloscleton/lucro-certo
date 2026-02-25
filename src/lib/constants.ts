// Detecta se estamos rodando no Vercel ou Local
const isProd = import.meta.env.PROD;
const envUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL = envUrl || (isProd ? 'https://lucro-certo-backend-carloscletons-projects.vercel.app' : 'http://localhost:3001');

console.log(`🌐 [Config] API_BASE_URL: ${API_BASE_URL} (isProd: ${isProd})`);
