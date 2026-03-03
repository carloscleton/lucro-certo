import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
    console.log("Checking profiles...");
    const { data: profiles } = await supabase.from('social_profiles').select('*');
    console.log("Profiles:", profiles);

    console.log("Checking posts...");
    const { data: posts } = await supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(5);
    console.log("Posts:", posts);
}

main();
