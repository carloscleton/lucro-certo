import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
    console.log("Checking instances...");
    const { data: instances } = await supabase.from('instances').select('*');
    console.log("Instances:", instances);

    console.log("Checking posts...");
    const { data: posts } = await supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(2);
    console.log("Posts:", posts);
}

main();
