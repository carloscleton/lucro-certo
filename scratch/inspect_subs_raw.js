import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env', 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
    console.error("Failed to parse .env file");
    process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Supabase URL:", supabaseUrl);

    // List all loyalty_subscriptions
    const { data: subs, error } = await supabase
        .from('loyalty_subscriptions')
        .select(`
            *,
            contact:contact_id(name),
            plan:plan_id(name)
        `);

    if (error) {
        console.error("Error fetching subscriptions:", error);
    } else {
        console.log(`Found ${subs?.length} subscriptions:`);
        console.log(JSON.stringify(subs, null, 2));
    }
}

main();
