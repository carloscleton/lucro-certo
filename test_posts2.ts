import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
    console.log("Checking posts...");
    const { data: posts } = await supabase.from('social_posts').select('*').order('created_at', { ascending: false }).limit(2);
    console.log("Posts:", posts);
}

main();
