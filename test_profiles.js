import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, anonKey)

async function main() {
    const { data: companies, error: cmpErr } = await supabase.from('companies').select('*');

    // We update all companies to have social copilot true to test
    if (companies) {
        for (const c of companies) {
            await supabase.from('companies').update({ has_social_copilot: true }).eq('id', c.id);
        }
    }
    console.log("Updated companies. Re-fetching...");

    // Fetch profiles and posts
    const { data: profiles } = await supabase.from('social_profiles').select('*');
    console.log("Profiles count:", profiles?.length);

    console.log("Fetching posts...");
    const { data: posts } = await supabase.from('social_posts').select('*');
    console.log("Posts count:", posts?.length);

    if (profiles && profiles.length > 0) {
        console.log("Calling cron webhook...");
        const res = await fetch("https://oncddbarrtxalsmzravk.supabase.co/functions/v1/social-copilot-cron", { method: 'POST' });
        console.log("Cron status:", res.status, await res.text());

        const { data: newPosts } = await supabase.from('social_posts').select('*');
        console.log("Posts count after cron:", newPosts?.length);
    }
}
main();
