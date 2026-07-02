const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, cnpj, entity_type, tecnospeed_config');

  if (error) {
    console.error('Error fetching companies:', error);
  } else {
    console.log('Companies:');
    for (const comp of companies) {
      console.log(`- Company: ${comp.name} (ID: ${comp.id})`);
      console.log(`  CNPJ: ${comp.cnpj}`);
      console.log(`  Config keys:`, comp.tecnospeed_config ? Object.keys(comp.tecnospeed_config) : 'null');
      console.log(`  nfse_nacional:`, comp.tecnospeed_config?.nfse_nacional);
      console.log(`  nfseNacional under nested config:`, comp.tecnospeed_config?.nfse?.config?.nfseNacional);
    }
  }
}
run();
