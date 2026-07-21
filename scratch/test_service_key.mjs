import dotenv from 'dotenv';
dotenv.config();

console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Length:", process.env.SUPABASE_SERVICE_ROLE_KEY.length);
    console.log("First 10 chars:", process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10));
}
