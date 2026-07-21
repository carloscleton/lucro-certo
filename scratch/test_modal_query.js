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

// Use the company ID we found earlier
const filterId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';

async function main() {
    console.log("Running loyalty_subscriptions query for company_id:", filterId);

    const { data: subsData, error: subsError } = await supabase
        .from('loyalty_subscriptions')
        .select(`
            id,
            status,
            next_due_at,
            created_at,
            contact:contact_id (
                id,
                name,
                tax_id,
                email,
                phone,
                whatsapp,
                zip_code,
                street,
                number,
                complement,
                neighborhood,
                city,
                state
            ),
            plan:plan_id (
                id,
                name,
                price
            )
        `)
        .eq('company_id', filterId)
        .in('status', ['active', 'overdue', 'pending']);

    if (subsError) {
        console.error("Query Error:", subsError);
    } else {
        console.log("Found subscriptions:", subsData?.length);
        console.log(JSON.stringify(subsData, null, 2));
    }
}

main();
