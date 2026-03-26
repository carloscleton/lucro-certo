
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkCols() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    console.error('❌ Error checking columns:', error);
  } else {
    const cols = Object.keys(data[0] || {});
    console.log('✅ Columns in transactions:', cols);
    if (!cols.includes('quote_id')) {
        console.warn('⚠️ quote_id column is MISSING!');
    } else {
        console.log('✅ quote_id column is PRESENT!');
    }
  }
}

checkCols();
