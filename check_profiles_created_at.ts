import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkColumns() {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    console.log('Sample profile:', data?.[0]);
    if (data?.[0]) {
        console.log('Columns:', Object.keys(data[0]));
    }
}
checkColumns();
