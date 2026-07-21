import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

// Re-create the logic of getEvolutionConfig and resolveTargetName and send
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY?.trim();
const EVOLUTION_GO_API_URL = process.env.EVOLUTION_GO_API_URL?.trim().replace(/\/+$/, '') || EVOLUTION_API_URL;
const EVOLUTION_GO_API_KEY = process.env.EVOLUTION_GO_API_KEY?.trim() || EVOLUTION_API_KEY;

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

async function getEvolutionConfig(identifier: { companyId?: string; instanceName?: string; token?: string }) {
    let companyId = identifier.companyId;
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

    if (!companyId && SUPABASE_URL && supabaseKey) {
        try {
            let query = `${SUPABASE_URL}/rest/v1/instances?`;
            if (identifier.token) {
                query += `evolution_instance_id=eq.${encodeURIComponent(identifier.token)}`;
            } else if (identifier.instanceName) {
                query += `instance_name=eq.${encodeURIComponent(identifier.instanceName)}`;
            } else {
                query = '';
            }

            if (query) {
                query += `&select=company_id`;
                const response = await axios.get(query, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`
                    }
                });
                if (response.data && response.data.length > 0) {
                    companyId = response.data[0].company_id;
                }
            }
        } catch (err: any) {
            console.error('⚠️ [Evolution Proxy] Error fetching instance company_id:', err.message);
        }
    }

    if (companyId && SUPABASE_URL && supabaseKey) {
        try {
            const response = await axios.get(
                `${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}&select=settings`,
                {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`
                    }
                }
            );
            if (response.data && response.data.length > 0) {
                const settings = response.data[0].settings || {};
                if (settings.whatsapp_provider === 'evolution_go') {
                    return {
                        url: EVOLUTION_GO_API_URL,
                        apiKey: EVOLUTION_GO_API_KEY,
                        isGo: true
                    };
                }
            }
        } catch (err: any) {
            console.error('⚠️ [Evolution Proxy] Error fetching company settings:', err.message);
        }
    }

    return {
        url: EVOLUTION_API_URL || '',
        apiKey: EVOLUTION_API_KEY || '',
        isGo: false
    };
}

async function resolveTargetName(requestedName: string, token?: string, passedCompanyId?: string): Promise<string> {
    try {
        let companyId: string | undefined = passedCompanyId;
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        if (!companyId && SUPABASE_URL && supabaseKey) {
            try {
                let query = `${SUPABASE_URL}/rest/v1/instances?`;
                if (token) {
                    query += `evolution_instance_id=eq.${encodeURIComponent(token)}`;
                } else {
                    query += `instance_name=eq.${encodeURIComponent(requestedName)}`;
                }
                query += `&select=company_id`;

                const dbRes = await axios.get(query, {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`
                    }
                });
                if (dbRes.data && dbRes.data.length > 0) {
                    companyId = dbRes.data[0].company_id;
                }
            } catch (dbErr: any) {
                console.warn('⚠️ [resolveTargetName] Error finding company_id in db:', dbErr.message);
            }
        }

        const config = await getEvolutionConfig({ companyId, token, instanceName: requestedName });

        const fetchInstancesList = async (activeConfig: typeof config) => {
            if (activeConfig.isGo) {
                const res = await axios.get(`${activeConfig.url}/instance/all`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                return res.data?.data || [];
            } else {
                const res = await axios.get(`${activeConfig.url}/instance/fetchInstances`, {
                    headers: { 'apikey': activeConfig.apiKey }
                });
                return Array.isArray(res.data) ? res.data : [];
            }
        };

        let instances: any[] = [];
        try {
            instances = await fetchInstancesList(config);
        } catch (primaryErr: any) {
            console.warn(`⚠️ resolveTargetName: fetchInstances failed on primary (${primaryErr.message}). Trying fallback config...`);
            const fallbackConfig = {
                url: config.isGo ? EVOLUTION_API_URL || '' : EVOLUTION_GO_API_URL || '',
                apiKey: config.isGo ? EVOLUTION_API_KEY || '' : EVOLUTION_GO_API_KEY || '',
                isGo: !config.isGo
            };
            try {
                instances = await fetchInstancesList(fallbackConfig);
            } catch (fallbackErr: any) {
                console.error(`❌ resolveTargetName: fetchInstances failed on both APIs.`);
                throw fallbackErr;
            }
        }

        if (token) {
            const cleanToken = token.trim().toLowerCase();
            const match = instances.find((i: any) =>
                (i.token && i.token.trim().toLowerCase() === cleanToken) ||
                (i.id && i.id.trim().toLowerCase() === cleanToken)
            );
            if (match) {
                return match.name || match.instanceName;
            }
        }

        const nameMatch = instances.find((i: any) =>
            (i.name || i.instanceName || '').toLowerCase() === requestedName.toLowerCase()
        );

        if (nameMatch) {
            return nameMatch.name || nameMatch.instanceName;
        }

        return requestedName;
    } catch (error) {
        console.error('❌ Erro ao resolver nome da instância:', error);
        return requestedName;
    }
}

async function simulate() {
    const instanceName = 'SLIN';
    const number = '5521959189126';
    const text = 'Olá! Teste de manual send.';
    const mediaUrl = 'https://lucrocertoweb-carloscletons-projects.vercel.app/api/fiscal-module/nfsenac/AVULSA_1783166447469_7676/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    
    console.log('Starting simulation...');
    try {
        const config = await getEvolutionConfig({ instanceName });
        console.log('Config resolved:', config);
        const targetName = await resolveTargetName(instanceName);
        console.log('TargetName resolved:', targetName);
        const encodedName = encodeURIComponent(targetName);
        
        console.log(`Sending media message to ${config.url}/message/sendMedia/${encodedName}...`);
        const response = await axios.post(`${config.url}/message/sendMedia/${encodedName}`, {
            number: number,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: text,
            media: mediaUrl,
            fileName: 'NotaFiscal.pdf'
        }, {
            headers: {
                'apikey': config.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });
        console.log('Success:', response.data);
    } catch (err: any) {
        console.error('Error detail:', err.response?.data || err.message);
    }
}

simulate();
