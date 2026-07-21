import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const tables = [
    'company_members',
    'profiles',
    'instances',
    'user_settings',
    'company_charges',
    'social_profiles',
    'social_posts',
    'radar_leads',
    'company_ai_settings'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(3);
    if (error) {
      console.log(`Table ${table}: Error - ${error.message}`);
    } else {
      console.log(`Table ${table}: Success - found ${data?.length || 0} rows. Sample:`, data);
    }
  }
}

check();
