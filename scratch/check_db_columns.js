import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('company_banking_configs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching from company_banking_configs:', error);
  } else {
    console.log('Sample record keys:', data && data.length > 0 ? Object.keys(data[0]) : 'No records found');
    console.log('Sample record:', data && data.length > 0 ? data[0] : 'None');
  }
}

checkColumns();
