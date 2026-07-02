const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found in env variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: invoices, error } = await supabase
    .from('fiscal_invoices')
    .select('id, external_id, invoice_number, type, status, pdf_url, created_at, company_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching invoices:', error);
  } else {
    console.log('Recent Invoices:');
    for (const inv of invoices) {
      console.log(`- ID: ${inv.id}`);
      console.log(`  External ID: ${inv.external_id}`);
      console.log(`  Number: ${inv.invoice_number}`);
      console.log(`  Type: ${inv.type}`);
      console.log(`  Status: ${inv.status}`);
      console.log(`  PDF URL: ${inv.pdf_url}`);
      console.log(`  Created: ${inv.created_at}`);
      console.log(`  Company ID: ${inv.company_id}`);
    }
  }
}
run();
