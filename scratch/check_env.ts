import dotenv from 'dotenv';
dotenv.config({ path: '.env.prod.local' });
dotenv.config();

console.log('Loaded production env keys:');
Object.keys(process.env).forEach(key => {
    if (key.includes('SUPABASE') || key.includes('DATABASE') || key.includes('KEY') || key.includes('SECRET')) {
        console.log(`- ${key}: length ${process.env[key]?.length || 0}`);
    }
});
