import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function testSimulation() {
    const startDate = '2026-06-01';
    const endDate = '2026-06-18';
    
    // Format ISO dates to fully cover the day
    const isoStartDate = `${startDate}T00:00:00.000Z`;
    const isoEndDate = `${endDate}T23:59:59.999Z`;

    console.log(`Starting simulation test from ${isoStartDate} to ${isoEndDate}...`);

    try {
        const compResponse = await axios.get(`${SUPABASE_URL}/rest/v1/companies`, {
            params: {
                select: 'id,trade_name,cnpj,settings,status'
            },
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const companies = compResponse.data || [];
        console.log(`Found ${companies.length} companies in DB.`);

        const simulationResults = [];

        for (const company of companies) {
            console.log(`\n--- Processing company: "${company.trade_name}" (ID: ${company.id}) ---`);
            if (company.status === 'blocked') {
                console.log(`Skipping blocked company.`);
                continue;
            }

            const settings = company.settings || {};
            const activeProvider = settings.fiscal_provider || 'tecnospeed';
            
            const billingConfig = settings.admin_fiscal_billing?.[activeProvider] || {};
            const fixedFee = typeof billingConfig.fixed_fee === 'number' ? billingConfig.fixed_fee : (settings.monthly_fee ?? 30.00);
            const perNoteFee = typeof billingConfig.per_note_fee === 'number' ? billingConfig.per_note_fee : 0.50;

            console.log(`- Active Provider: ${activeProvider}`);
            console.log(`- Fixed Fee: ${fixedFee}, Per Note Fee: ${perNoteFee}`);

            try {
                const invoicesCountResponse = await axios.get(`${SUPABASE_URL}/rest/v1/fiscal_invoices`, {
                    params: {
                        company_id: `eq.${company.id}`,
                        status: 'in.(concluido,autorizada,concluído)',
                        and: `(created_at.gte.${isoStartDate},created_at.lte.${isoEndDate})`,
                        select: 'id',
                        limit: 1
                    },
                    headers: {
                        'apikey': SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        'Prefer': 'count=exact'
                    }
                });

                const contentRange = invoicesCountResponse.headers['content-range'] || '';
                const countMatch = contentRange.match(/\/(\d+)$/);
                const notesCount = countMatch ? parseInt(countMatch[1]) : 0;
                console.log(`- Invoices count in range: ${notesCount}`);

                let issuerStatus = 'Sem Configuração ❌';
                if (activeProvider === 'nfeio') {
                    const nfeio = settings.nfeio_config || {};
                    issuerStatus = nfeio.apiKey && nfeio.companyId 
                        ? (nfeio.certificado_id || nfeio.certificado_status === 'ativo' ? 'Certificado OK ✅' : 'Sem Certificado ❌')
                        : 'Sem Configuração ❌';
                } else if (activeProvider === 'tecnospeed') {
                    const ts = settings.tecnospeed_config || {};
                    issuerStatus = ts.cnpjSh && ts.tokenSh 
                        ? (ts.certificado_id || ts.certificado_status === 'ativo' ? 'Certificado OK ✅' : 'Sem Certificado ❌')
                        : 'Sem Configuração ❌';
                } else if (activeProvider === 'other') {
                    const ts = settings.tecnospeed_config || {};
                    issuerStatus = ts.use_external_webhook && ts.external_webhook_url
                        ? 'Webhook Ativo ✅'
                        : 'Sem Configuração ❌';
                }
                console.log(`- Issuer Status: ${issuerStatus}`);

                const commissionEarned = company.commission_earned || 0; 
                const notesCost = notesCount * perNoteFee;
                const totalSuggested = fixedFee + notesCost + commissionEarned;

                simulationResults.push({
                    companyId: company.id,
                    tradeName: company.trade_name,
                    cnpj: company.cnpj,
                    activeProvider,
                    issuerStatus,
                    fixedFee,
                    perNoteFee,
                    notesCount,
                    notesCost,
                    commissions: commissionEarned,
                    totalSuggested,
                    isExempt: !!settings.billing_exempt
                });
            } catch (err) {
                console.error(`❌ Error querying fiscal_invoices for "${company.trade_name}":`, err.response?.data || err.message);
            }
        }

        console.log('\n====================================');
        console.log(`Simulation complete. Results (${simulationResults.length}):`);
        console.log(JSON.stringify(simulationResults, null, 2));

    } catch (err) {
        console.error('❌ Global simulation error:', err.response?.data || err.message);
    }
}

testSimulation();
