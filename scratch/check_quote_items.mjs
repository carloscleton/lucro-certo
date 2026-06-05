import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('quote_items').select('*').limit(1);
  if (error) {
    console.error('Error fetching quote_items:', error);
  } else {
    console.log('Columns in quote_items:', Object.keys(data[0] || {}));
  }
}

main();
