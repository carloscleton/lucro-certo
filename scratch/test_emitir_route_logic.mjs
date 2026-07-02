import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Mock sanitizeKey
function sanitizeKey(key) {
    if (!key) return '';
    return key.replace(/["']/g, '').trim();
}

// Mock getCompanyFiscalConfig using service role (bypass authHeader requirement)
async function getCompanyFiscalConfig(companyId) {
    const { data: company, error } = await supabase
        .from('companies')
        .select('id,tecnospeed_config,settings')
        .eq('id', companyId)
        .single();
    if (error || !company) {
        throw new Error('Company not found');
    }
    return {
        config: company.tecnospeed_config || {},
        realCompanyId: company.id,
        settings: company.settings || {}
    };
}

async function getCityNameFromIbge(codigoIbge) {
    try {
        const cleanIbge = String(codigoIbge).replace(/\D/g, '').trim();
        if (cleanIbge.length === 7) {
            const response = await axios.get(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cleanIbge}`, {
                timeout: 3000
            });
            if (response.data?.nome) {
                return response.data.nome;
            }
        }
    } catch (err) {
        console.warn('IBGE error:', err.message);
    }
    return '';
}

async function main() {
    // User request input payload (Manual JSON from screen)
    const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    const isLabTest = true;
    const provider = 'nfeio';
    
    const payload = [
      {
        "idIntegracao": "TEST_1781552611953",
        "emitente": {
          "tipo": 1,
          "codigoCidade": "2408102"
        },
        "prestador": {
          "cpfCnpj": "08187168000160",
          "inscricaoMunicipal": "1254103"
        },
        "tomador": {
          "cpfCnpj": "08187168000160",
          "inscricaoMunicipal": "1254103"
        },
        "servico": [
          {
            "codigo": "115013000",
            "discriminacao": "SERVICOS DE TI",
            "valor": {
              "servico": 50.00
            }
          }
        ]
      }
    ];

    try {
        console.log('🏁 Starting simulation of /emitir route logic...');
        const { config, realCompanyId: resolvedId, settings } = await getCompanyFiscalConfig(companyId);
        
        const activeProvider = settings?.fiscal_provider || 'tecnospeed';
        console.log(`Active Provider: ${activeProvider}`);

        if (activeProvider === 'nfeio') {
            const nfeioConfig = settings?.nfeio_config;
            if (!nfeioConfig || !nfeioConfig.apiKey || !nfeioConfig.companyId) {
                throw new Error('Configuração da NFe.io incompleta.');
            }

            const isSandbox = nfeioConfig.ambiente === 'homologacao';
            const apiKey = nfeioConfig.apiKey.trim();
            const companyIdNfe = nfeioConfig.companyId.trim();

            const firstItem = Array.isArray(payload) ? payload[0] : payload;
            let taxNumber = String(firstItem?.tomador?.cpfCnpj || '').replace(/\D/g, '');
            
            if (taxNumber === '99999999999999') {
                taxNumber = '00000000000191';
            }
            
            const borrowerType = taxNumber.length === 11 ? 'NaturalPerson' : (taxNumber.length === 14 ? 'LegalEntity' : 'Undefined');
            const tomadorEnd = firstItem?.tomador?.endereco || {};
            const serviceItem = Array.isArray(firstItem?.servico) ? firstItem?.servico[0] : firstItem?.servico;
            
            const rawAmount = serviceItem?.valor?.servico
                || serviceItem?.valor?.liquido
                || serviceItem?.valor?.bruto
                || serviceItem?.valorUnitario
                || serviceItem?.valorTotal
                || firstItem?.valor?.servico
                || firstItem?.valorServico
                || 0;
            const servicesAmount = Number(rawAmount);

            if (servicesAmount <= 0) {
                throw new Error('servicesAmount <= 0');
            }

            const stateValue = String(tomadorEnd.uf || tomadorEnd.estado || '').trim().toUpperCase();
            const cityCode   = String(tomadorEnd.codigoCidade || firstItem?.emitente?.codigoCidade || '').trim();
            
            let cityName = String(tomadorEnd.cidade || tomadorEnd.descricaoCidade || '').trim();
            if (!cityName && cityCode) {
                console.log(`Resolving IBGE name for ${cityCode}...`);
                cityName = await getCityNameFromIbge(cityCode);
                console.log(`Resolved city name: ${cityName}`);
            }

            // --- RESOLUÇÃO DE FALLBACKS DE ENDEREÇO PARA NFE.IO ---
            const companyEnd = config?.endereco || {};
            const fallbackCep = String(companyEnd.cep || '59000000').replace(/\D/g, '');
            const fallbackStreet = String(companyEnd.logradouro || 'Rua Principal').trim();
            const fallbackNumber = String(companyEnd.numero || 'S/N').trim();
            const fallbackDistrict = String(companyEnd.bairro || 'Centro').trim();
            const fallbackState = String(companyEnd.uf || 'RN').trim().toUpperCase();
            const fallbackCityCode = String(companyEnd.codigoCidade || '2408102').trim();

            const finalCep = String(tomadorEnd.cep || '').replace(/\D/g, '') || fallbackCep;
            const finalStreet = String(tomadorEnd.logradouro || '').trim() || fallbackStreet;
            const finalNumber = String(tomadorEnd.numero || '').trim() || fallbackNumber;
            const finalDistrict = String(tomadorEnd.bairro || '').trim() || fallbackDistrict;
            const finalState = stateValue || fallbackState;
            const finalCityCode = cityCode && cityCode !== '0' ? cityCode : fallbackCityCode;

            if (!cityName || cityName === 'Cidade Não Informada') {
                if (finalCityCode) {
                    cityName = await getCityNameFromIbge(finalCityCode);
                }
                if (!cityName) cityName = 'Natal';
            }

            const toDecimalRate = (v) => v > 1 ? v / 100 : v;
            const issRateFromPayload = serviceItem?.iss?.aliquota ? toDecimalRate(Number(serviceItem.iss.aliquota)) : undefined;
            const issRateFromConfig  = nfeioConfig.aliquotaIss ? toDecimalRate(Number(String(nfeioConfig.aliquotaIss).replace(',', '.'))) : undefined;
            const issRate = issRateFromPayload || issRateFromConfig;

            const inscricaoMunicipal = String(
                firstItem?.prestador?.inscricaoMunicipal ||
                nfeioConfig.inscricaoMunicipal ||
                ''
            ).trim();

            const nfeioPayload = {
                cityServiceCode: String(nfeioConfig.cityServiceCode || serviceItem?.codigo || nfeioConfig.cnae || '1.01').trim(),
                description: String(serviceItem?.discriminacao || serviceItem?.descricao || 'Prestação de serviço').trim(),
                servicesAmount,
                environmentType: isSandbox ? 'test' : 'production',
                borrower: {
                    type: borrowerType,
                    federalTaxNumber: taxNumber || '0',
                    name: String(firstItem?.tomador?.razaoSocial || firstItem?.tomador?.nomeFantasia || 'CLIENTE NAO IDENTIFICADO').trim(),
                    email: firstItem?.tomador?.email || null,
                    address: {
                        country: 'BRA',
                        postalCode: finalCep,
                        street: finalStreet,
                        number: finalNumber,
                        additionalInformation: String(tomadorEnd.complemento || '').trim() || undefined,
                        district: finalDistrict,
                        state: finalState,
                        city: {
                            code: finalCityCode,
                            name: cityName
                        }
                    }
                }
            };

            if (issRate && issRate > 0) nfeioPayload.issRate = issRate;
            if (inscricaoMunicipal) nfeioPayload.municipalTaxNumber = inscricaoMunicipal;
            if (nfeioConfig.simplesNacional !== undefined) nfeioPayload.simpleSocialScheme = Boolean(nfeioConfig.simplesNacional);
            if (nfeioConfig.cnae) nfeioPayload.cnaeCode = String(nfeioConfig.cnae).trim();

            console.log('📤 Submitting payload to NFe.io:', JSON.stringify(nfeioPayload, null, 2));
            const response = await axios.post(`https://api.nfe.io/v1/companies/${companyIdNfe}/serviceinvoices`, nfeioPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': apiKey
                }
            });

            console.log('🎉 SUCCESS!', response.data);
        }
    } catch (err) {
        console.error('❌ SIMULATION FAILED:', err.message, err.response?.data || '');
    }
}

main();
