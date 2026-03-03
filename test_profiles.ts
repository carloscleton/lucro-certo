import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
// Using Service Role to bypass RLS
const supabase = createClient(supabaseUrl, serviceKey)

async function main() {
    const { data: companies, error: cmpErr } = await supabase.from('companies').select('*');

    // update all to true
    if (companies) {
        for (const c of companies) {
            await supabase.from('companies').update({ has_social_copilot: true }).eq('id', c.id);
        }
    }

    const { data: profiles } = await supabase.from('social_profiles').select('*');
    console.log("Profiles count (service role):", profiles?.length, profiles);

    const { data: posts } = await supabase.from('social_posts').select('*');
    console.log("Posts count (service role):", posts?.length);

    // Call webhook
    if (profiles && profiles.length > 0) {
        console.log("Calling cron edge function...");
        const res = await fetch("https://oncddbarrtxalsmzravk.supabase.co/functions/v1/social-copilot-cron", { method: 'POST' });
        console.log("Cron status:", res.status, await res.text());

        const { data: newPosts } = await supabase.from('social_posts').select('*');
        console.log("Posts count after cron:", newPosts?.length);
    } else {
        console.log("No profiles found to run cron for.");
    }
}
main();
