import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../.env' }); // Fallback to root .env

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function runTest() {
  console.log("🚀 Starting end-to-end Webhook Invoice Test...");

  // 1. Fetch a company to use for the test
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, settings, tecnospeed_config')
    .limit(1);

  if (compErr || !companies || companies.length === 0) {
    console.error("❌ Failed to fetch a company:", compErr?.message || "No companies found");
    process.exit(1);
  }

  const company = companies[0];
  console.log(`🏢 Selected company: ${company.id}`);

  // Fetch a quote belonging to this company (optional but recommended for test coverage)
  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, nfe_status, nfe_pdf_url')
    .eq('company_id', company.id)
    .limit(1);
  
  const testQuote = quotes && quotes.length > 0 ? quotes[0] : null;
  if (testQuote) {
    console.log(`📋 Found quote ${testQuote.id} to test quote status updates!`);
  } else {
    console.log("📋 No quotes found for this company. Quote status updates test will be skipped.");
  }

  // Save original settings
  const originalSettings = { ...company.settings };
  const originalConfig = { ...company.tecnospeed_config };

  try {
    // 2. Modify company settings to use external webhook ('other')
    console.log("⚙️ Setting company provider to 'other' and configuring webhook...");
    const updatedSettings = {
      ...originalSettings,
      fiscal_provider: 'other'
    };
    const updatedConfig = {
      ...originalConfig,
      use_external_webhook: true,
      external_webhook_url: 'https://httpbin.org/post', // httpbin always echoes the request with 200 OK
      external_webhook_token: 'test-token-123'
    };

    const { error: updateErr } = await supabase
      .from('companies')
      .update({
        settings: updatedSettings,
        tecnospeed_config: updatedConfig
      })
      .eq('id', company.id);

    if (updateErr) {
      throw new Error(`Failed to update company config: ${updateErr.message}`);
    }

    console.log("✅ Company config updated successfully.");

    // 3. Emit a dummy invoice via the proxy
    console.log("📤 Calling /api/fiscal-module/emitir...");
    const dummyPayload = {
      prestador: {
        cpfCnpj: "08187168000160",
        inscricaoMunicipal: "123456"
      },
      tomador: {
        cpfCnpj: "00000000000000",
        razaoSocial: "Cliente Teste Webhook",
        email: "teste-webhook@exemplo.com"
      },
      servico: [
        {
          codigo: "010101",
          discriminacao: "Servico de teste via Webhook",
          valorUnitario: 150.00
        }
      ]
    };

    const emitResponse = await axios.post('http://localhost:3001/api/fiscal-module/emitir', {
      companyId: company.id,
      payload: dummyPayload,
      type: 'nfse',
      provider: 'other',
      quoteId: testQuote ? testQuote.id : undefined
    }, {
      headers: {
        'Authorization': `Bearer ${serviceKey}` // using service role to bypass auth check in endpoint
      }
    });

    console.log("📥 Response from emitir:", JSON.stringify(emitResponse.data, null, 2));

    const invoiceId = emitResponse.data.id;
    if (!invoiceId || !invoiceId.startsWith('webhook_')) {
      throw new Error(`Invalid invoice ID returned: ${invoiceId}`);
    }
    console.log(`🎯 Invoice created with integration ID: ${invoiceId}`);

    // 4. Verify invoice exists in DB with status 'processando'
    console.log("🔍 Checking invoice status in database...");
    const { data: dbInvoice, error: queryErr } = await supabase
      .from('fiscal_invoices')
      .select('*')
      .eq('external_id', invoiceId)
      .maybeSingle();

    if (queryErr || !dbInvoice) {
      throw new Error(`Invoice not found in database: ${queryErr?.message}`);
    }

    console.log(`✅ Invoice found in database! Status: ${dbInvoice.status}, Type: ${dbInvoice.type}`);
    if (dbInvoice.status !== 'processando') {
      throw new Error(`Expected status 'processando', got '${dbInvoice.status}'`);
    }

    // 5. Simulate webhook callback to update the status to 'concluido'
    console.log("📡 Simulating external webhook callback update...");
    const callbackResponse = await axios.post('http://localhost:3001/api/fiscal-module/webhook/update', {
      id: invoiceId,
      status: 'concluido',
      pdf_url: 'https://lucrocerto.s3.amazonaws.com/invoices/mock-pdf-123.pdf',
      xml_url: 'https://lucrocerto.s3.amazonaws.com/invoices/mock-xml-123.xml',
      invoice_number: '98765',
      access_key: '35260608187168000160550010000987651000987654',
      protocol: '12415616263'
    }, {
      headers: {
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    console.log("📥 Callback response:", JSON.stringify(callbackResponse.data, null, 2));
    if (!callbackResponse.data.success) {
      throw new Error("Callback endpoint returned failure");
    }

    // 6. Verify invoice status has been updated in database
    console.log("🔍 Re-checking invoice status in database...");
    const { data: updatedDbInvoice, error: queryErr2 } = await supabase
      .from('fiscal_invoices')
      .select('*')
      .eq('external_id', invoiceId)
      .maybeSingle();

    if (queryErr2 || !updatedDbInvoice) {
      throw new Error(`Updated invoice not found: ${queryErr2?.message}`);
    }

    console.log(`✅ Invoice updated in database!`);
    console.log(`- Status: ${updatedDbInvoice.status}`);
    console.log(`- Number: ${updatedDbInvoice.invoice_number}`);
    console.log(`- PDF URL: ${updatedDbInvoice.pdf_url}`);
    console.log(`- Access Key: ${updatedDbInvoice.access_key}`);

    if (updatedDbInvoice.status !== 'concluido') {
      throw new Error(`Expected status 'concluido', got '${updatedDbInvoice.status}'`);
    }
    if (updatedDbInvoice.invoice_number !== '98765') {
      throw new Error(`Expected number '98765', got '${updatedDbInvoice.invoice_number}'`);
    }

    // Verify linked quote status is updated
    if (testQuote) {
      console.log("🔍 Checking linked quote status in database...");
      const { data: updatedQuote, error: quoteQueryErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', testQuote.id)
        .maybeSingle();

      if (quoteQueryErr || !updatedQuote) {
        throw new Error(`Linked quote not found: ${quoteQueryErr?.message}`);
      }

      console.log(`✅ Quote updated in database!`);
      console.log(`- Status: ${updatedQuote.nfe_status}`);
      console.log(`- PDF URL: ${updatedQuote.nfe_pdf_url}`);

      if (updatedQuote.nfe_status !== 'concluido') {
        throw new Error(`Expected quote status 'concluido', got '${updatedQuote.nfe_status}'`);
      }
    }

    // 7. Test status endpoint bypass
    console.log("🔍 Checking status bypass endpoint /api/fiscal-module/status/:id...");
    const statusResponse = await axios.get(`http://localhost:3001/api/fiscal-module/status/${invoiceId}`, {
      params: { companyId: company.id },
      headers: {
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    console.log("📥 Status endpoint response:", JSON.stringify(statusResponse.data, null, 2));
    if (statusResponse.data.status !== 'concluido') {
      throw new Error(`Expected status 'concluido' from bypass endpoint, got '${statusResponse.data.status}'`);
    }

    // 8. Clean up created invoice
    console.log("🧹 Cleaning up created invoice from database...");
    const { error: deleteInvErr } = await supabase
      .from('fiscal_invoices')
      .delete()
      .eq('external_id', invoiceId);

    if (deleteInvErr) {
      console.warn("⚠️ Failed to delete test invoice:", deleteInvErr.message);
    } else {
      console.log("✅ Test invoice cleaned up.");
    }

  } finally {
    // 9. Restore original settings
    console.log("🧹 Restoring original company configuration...");
    const { error: restoreErr } = await supabase
      .from('companies')
      .update({
        settings: originalSettings,
        tecnospeed_config: originalConfig
      })
      .eq('id', company.id);

    if (restoreErr) {
      console.error("❌ Failed to restore company configuration:", restoreErr.message);
    } else {
      console.log("✅ Company configuration restored.");
    }

    // Restore quote status
    if (testQuote) {
      console.log("🧹 Restoring original quote status...");
      await supabase
        .from('quotes')
        .update({
          nfe_status: testQuote.nfe_status || null,
          nfe_pdf_url: testQuote.nfe_pdf_url || null
        })
        .eq('id', testQuote.id);
      console.log("✅ Quote status restored.");
    }
  }

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! End-to-end integration is 100% functional.");
}

runTest();
