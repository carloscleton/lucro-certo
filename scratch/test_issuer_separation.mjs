import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = 'https://oncddbarrtxalsmzravk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function runTest() {
    const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7'; // SERVICE LINE INFORMATICA

    try {
        // Fetch company settings to see what is set
        const compRes = await axios.get(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}&select=*`, {
            headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            }
        });
        const company = compRes.data[0];
        console.log(`Company settings:`, JSON.stringify(company.settings, null, 2));

        // Now run the exact simulation code
        const settings = company.settings || {};
        const activeProvider = settings.fiscal_provider || 'tecnospeed';
        const isExempt = !!settings.fiscal_billing_exempt;

        console.log(`Company active provider: ${activeProvider}`);
        console.log(`Company isExempt: ${isExempt}`);

        // Mock invoices: 2 active NFe.io, 3 active Tecnospeed, 1 canceled Tecnospeed
        const invoices = [
            // 2 NFe.io active
            { type: 'nfeio', status: 'autorizada' },
            { type: 'nfeio', status: 'concluido' },
            // 3 Tecnospeed active
            { type: 'nfse', status: 'autorizada' },
            { type: 'nfse', status: 'concluído' },
            { type: 'nfsenac', status: 'concluido' },
            // 1 Tecnospeed canceled
            { type: 'nfse', status: 'cancelada' }
        ];

        console.log(`Processing ${invoices.length} mock invoices...`);

        const providers = new Set();
        providers.add(activeProvider);
        for (const inv of invoices) {
            const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
            providers.add(p);
        }

        const simulationResults = [];

        for (const provider of providers) {
            const isActive = provider === activeProvider;
            const billingConfig = settings.admin_fiscal_billing?.[provider] || {};

            let fixedFeeToApply = 0.00;
            if (isActive) {
                const fixedFee = typeof billingConfig.fixed_fee === 'number' 
                    ? billingConfig.fixed_fee 
                    : (settings.monthly_fee ?? 30.00);
                fixedFeeToApply = isExempt ? 0.00 : fixedFee;
            }

            const perNoteFee = typeof billingConfig.per_note_fee === 'number' 
                ? billingConfig.per_note_fee 
                : 0.50;

            const providerInvoices = invoices.filter(inv => {
                const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
                return p === provider;
            });

            const notesCount = providerInvoices.filter(inv => 
                ['concluido', 'autorizada', 'concluído'].includes(String(inv.status).toLowerCase())
            ).length;

            const canceledCount = providerInvoices.filter(inv => 
                ['cancelado', 'cancelada'].includes(String(inv.status).toLowerCase())
            ).length;

            if (!isActive && notesCount === 0 && canceledCount === 0) {
                continue;
            }

            let issuerStatus = 'Sem Configuração ❌';
            if (isActive) {
                if (provider === 'nfeio') {
                    const nfeio = settings.nfeio_config || {};
                    issuerStatus = nfeio.apiKey && nfeio.companyId 
                        ? (nfeio.certificado_id || nfeio.certificado_status === 'ativo' ? 'Certificado OK ✅' : 'Sem Certificado ❌')
                        : 'Sem Configuração ❌';
                } else if (provider === 'tecnospeed') {
                    const ts = company.tecnospeed_config || {};
                    issuerStatus = ts.cnpjSh && ts.tokenSh 
                        ? (ts.certificado_id || ts.certificado_status === 'ativo' ? 'Certificado OK ✅' : 'Sem Certificado ❌')
                        : 'Sem Configuração ❌';
                } else if (provider === 'other') {
                    const ts = company.tecnospeed_config || {};
                    issuerStatus = ts.use_external_webhook && ts.external_webhook_url
                        ? 'Webhook Ativo ✅'
                        : 'Sem Configuração ❌';
                }
            } else {
                issuerStatus = 'Histórico (Inativo) ⚠️';
            }

            const notesCost = (notesCount + canceledCount) * perNoteFee;
            const totalSuggested = fixedFeeToApply + notesCost;

            simulationResults.push({
                companyId: company.id,
                tradeName: company.trade_name,
                cnpj: company.cnpj,
                provider,
                isActiveProvider: isActive,
                issuerStatus,
                fixedFee: fixedFeeToApply,
                perNoteFee,
                notesCount,
                canceledCount,
                notesCost,
                totalSuggested,
                isExempt
            });
        }

        console.log('\n====================================');
        console.log('SIMULATION RESULTS:');
        console.log(JSON.stringify(simulationResults, null, 2));
        console.log('====================================\n');

    } catch (err) {
        console.error('Test execution failed:', err.response?.data || err.message);
    }
}

runTest();
