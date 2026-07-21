import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: aiSettings, error } = await supabase
    .from('company_ai_settings')
    .select('*, companies(trade_name)');
  
  if (error) {
    console.error("Error fetching company_ai_settings:", error);
    return;
  }
  
  console.log("AI Settings Count:", aiSettings?.length);
  for (const s of aiSettings || []) {
    console.log(`Company: ${s.companies?.trade_name || 'unknown'} (${s.company_id})`);
    console.log(`  Serper Key: ${s.serper_api_key ? 'YES (present)' : 'NO'}`);
    console.log(`  SearchAPI Key: ${s.searchapi_api_key ? 'YES (present)' : 'NO'}`);
    console.log(`  OpenAI Key: ${s.openai_api_key ? 'YES (present)' : 'NO'}`);
    console.log(`  Gemini Key: ${s.gemini_api_key ? 'YES (present)' : 'NO'}`);
  }
}

check();
