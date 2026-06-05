import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  // Try to insert a dummy record with a non-existent column to see if it fails with columns list
  console.log("Testing insert on quote_items with invalid columns...");
  const { data, error } = await supabase.from('quote_items').insert([{
    quote_id: '00000000-0000-0000-0000-000000000000',
    description: 'test',
    quantity: 1,
    unit_price: 10,
    total_price: 10,
    codigo_tributacao_nacional: '123'
  }]);
  console.log("Insert response error:", error);
}

main();
