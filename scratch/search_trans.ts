import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function search() {
    console.log('URL:', process.env.VITE_SUPABASE_URL);
    
    const { data, error } = await supabase
        .from('transactions')
        .select('id, description, amount, status, type, notes');
        
    if (error) {
        console.error('Error fetching transactions:', error);
        return;
    }
    
    console.log(`Total transactions in DB: ${data?.length}`);
    if (data && data.length > 0) {
        console.log('Sample IDs:');
        data.slice(0, 10).forEach(t => console.log(`- ${t.id} (${t.description}, ${t.amount})`));
    }
}

search();
