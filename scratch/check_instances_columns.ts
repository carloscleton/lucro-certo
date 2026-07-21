import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
const supabase = createClient(supabaseUrl, supabaseKey!)

async function test() {
    console.log('Querying instances table structure...');
    const { data, error } = await supabase
        .from('instances')
        .select('*')
        .limit(1);
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Data:', data);
}

test();
