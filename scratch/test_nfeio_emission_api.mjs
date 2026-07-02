import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    console.log(`🔍 Fetching config for company ${companyId}...`);

    // Fetch company settings
    const { data: company, error: compErr } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();

    if (compErr || !company) {
        console.error('Error fetching company:', compErr);
        return;
    }

    const settings = company.settings || {};
    const nfeioConfig = settings.nfeio_config;
    if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
        console.error('NFe.io configuration is incomplete or missing in database:', nfeioConfig);
        return;
    }

    console.log('✅ Company Settings found:', {
        tradeName: company.trade_name,
        nfeioCompanyId: nfeioConfig.companyId,
        environment: nfeioConfig.ambiente,
        cnae: nfeioConfig.cnae,
        cityServiceCode: nfeioConfig.cityServiceCode,
        issRate: nfeioConfig.aliquotaIss
    });

    // Fetch a contact to use as borrower
    const { data: contacts, error: contactErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .limit(1);

    if (contactErr || !contacts || contacts.length === 0) {
        console.error('Error or no contacts found for company:', contactErr);
        return;
    }

    const contact = contacts[0];
    console.log('✅ Contact (Borrower) selected:', {
        id: contact.id,
        name: contact.name,
        tax_id: contact.tax_id,
        zip_code: contact.zip_code,
        city: contact.city,
        state: contact.state
    });

    // Build payload exactly as the backend does
    const taxNumber = String(contact.tax_id || '').replace(/\D/g, '');
    const borrowerType = taxNumber.length === 11 ? 'NaturalPerson' : (taxNumber.length === 14 ? 'LegalEntity' : 'Undefined');
    const isSandbox = nfeioConfig.ambiente === 'homologacao';
    
    // Resolve city name using public IBGE API
    const cityCode = '2408102'; // From modal
    let cityName = '';
    try {
        const ibgeRes = await axios.get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cityCode}`);
        cityName = ibgeRes.data?.nome || '';
    } catch (e) {
        console.warn('IBGE fetch failed');
    }

    const nfeioPayload = {
        cityServiceCode: String(nfeioConfig.cityServiceCode || '1.01').trim(),
        description: 'SERVIÇOS DE SUPORTE EM TECNOLOGIA DA INFORMAÇÃO (TI)',
        servicesAmount: 50.00,
        environmentType: isSandbox ? 'test' : 'production',
        borrower: {
            type: borrowerType,
            federalTaxNumber: taxNumber || '0',
            name: String(contact.name || 'CLIENTE NAO IDENTIFICADO').trim(),
            email: contact.email || null,
            address: {
                country: 'BRA',
                postalCode: String(contact.zip_code || '59000000').replace(/\D/g, ''),
                street: String(contact.street || 'Rua Teste').trim(),
                number: String(contact.number || '123').trim(),
                district: String(contact.neighborhood || 'Bairro Teste').trim(),
                state: String(contact.state || 'RN').trim().toUpperCase(),
                city: {
                    code: cityCode,
                    name: cityName || 'Natal'
                }
            }
        }
    };

    if (nfeioConfig.aliquotaIss) {
        const toDecimalRate = (v) => v > 1 ? v / 100 : v;
        const issRate = toDecimalRate(Number(String(nfeioConfig.aliquotaIss).replace(',', '.')));
        if (issRate > 0) nfeioPayload.issRate = issRate;
    }
    if (nfeioConfig.inscricaoMunicipal) {
        nfeioPayload.municipalTaxNumber = String(nfeioConfig.inscricaoMunicipal).trim();
    }
    if (nfeioConfig.simplesNacional !== undefined) {
        nfeioPayload.simpleSocialScheme = Boolean(nfeioConfig.simplesNacional);
    }
    if (nfeioConfig.cnae) {
        nfeioPayload.cnaeCode = String(nfeioConfig.cnae).trim();
    }

    console.log('📤 Submitting payload to NFe.io:', JSON.stringify(nfeioPayload, null, 2));

    try {
        const response = await axios.post(`https://api.nfe.io/v1/companies/${nfeioConfig.companyId.trim()}/serviceinvoices`, nfeioPayload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': nfeioConfig.apiKey.trim()
            }
        });
        console.log('🎉 SUCCESS!', response.data);
    } catch (err) {
        console.error('❌ ERROR!', err.response?.status, JSON.stringify(err.response?.data, null, 2) || err.message);
    }
}

main();
