import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first, then fall back to .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing configuration keys!');
    process.exit(1);
}

console.log('Connecting to Supabase at:', supabaseUrl);
console.log('Using service role key:', supabaseKey === process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No (anon)');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHumana() {
    // Let's search for "Humana" in description (case insensitive) or retrieve the last 50 transactions
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .ilike('description', '%HUMANA%')
        .order('date', { ascending: true });

    if (error) {
        console.error('Error fetching Humana transactions:', error);
        return;
    }

    console.log('Humana Transactions found:', data?.length);
    console.table(data?.map(t => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        recurrence_group_id: t.recurrence_group_id,
        installment_number: t.installment_number,
        attachment_url: t.attachment_url ? 'Yes' : 'No',
        description: t.description,
        notes: t.notes ? t.notes.substring(0, 50) + '...' : ''
    })));
}

checkHumana();
