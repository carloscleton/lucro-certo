import dotenv from 'dotenv'
dotenv.config()

console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('SUPABASE_URL:', process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
console.log('EVOLUTION_API_URL:', process.env.EVOLUTION_API_URL);
console.log('EVOLUTION_API_KEY exists:', !!process.env.EVOLUTION_API_KEY);
console.log('EVOLUTION_GO_API_URL:', process.env.EVOLUTION_GO_API_URL);
console.log('EVOLUTION_GO_API_KEY exists:', !!process.env.EVOLUTION_GO_API_KEY);
