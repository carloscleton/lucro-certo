import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '');

async function checkCols() {
  const { data, error } = await supabase.from('loyalty_plans').select('*').limit(1);
  if (error) {
    console.error('❌ Error checking columns:', error);
  } else {
    console.log('✅ Columns in loyalty_plans:', data && data[0] ? Object.keys(data[0]) : 'No rows returned or empty table');
  }
}

checkCols();
