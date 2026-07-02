import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    const { data, error } = await supabase
        .from('transactions')
        .select('description, amount, notes, type, status')
        .limit(20);

    if (error) {
        console.error('Error fetching transactions:', error);
        return;
    }

    console.log("All transactions:");
    console.table(data);
}

run();
