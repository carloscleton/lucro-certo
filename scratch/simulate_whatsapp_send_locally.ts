import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '');
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY?.trim();

const EVOLUTION_GO_API_URL = process.env.EVOLUTION_GO_API_URL?.trim().replace(/\/+$/, '') || EVOLUTION_API_URL;
const EVOLUTION_GO_API_KEY = process.env.EVOLUTION_GO_API_KEY?.trim() || EVOLUTION_API_KEY;

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)?.trim().replace(/\/+$/, '');
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

async function getEvolutionConfig(identifier: { companyId?: string; instanceName?: string; token?: string; userToken?: string }) {
    let companyId = identifier.companyId;
    const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    const authHeader = identifier.userToken || (SUPABASE_SERVICE_ROLE_KEY ? `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` : `Bearer ${supabaseKey}`);

    const nameToMatch = identifier.instanceName?.toLowerCase().trim();
    const tokenToMatch = identifier.token?.toLowerCase().trim();

    // 🔍 1. Tentar auto-detecção consultando ambas as APIs em paralelo
    if (nameToMatch || tokenToMatch) {
        try {
            const [goListRes, stdListRes] = await Promise.allSettled([
                axios.get(`${EVOLUTION_GO_API_URL}/instance/all`, { headers: { 'apikey': EVOLUTION_GO_API_KEY }, timeout: 1500 }),
                axios.get(`${EVOLUTION_API_URL}/instance/fetchInstances`, { headers: { 'apikey': EVOLUTION_API_KEY }, timeout: 1500 })
            ]);

            // Verificar se está na Evolution GO
            if (goListRes.status === 'fulfilled') {
                const goInstances = goListRes.value.data?.data || [];
                const foundInGo = goInstances.some((i: any) =>
                    (nameToMatch && (i.name || i.instanceName || '').toLowerCase().trim() === nameToMatch) ||
                    (tokenToMatch && (i.token || i.id || '').toLowerCase().trim() === tokenToMatch)
                );
                if (foundInGo) {
                    console.log(`🔌 [Evolution Config] Instância ${identifier.instanceName || identifier.token} auto-detectada no EVOLUTION GO`);
                    return {
                        url: EVOLUTION_GO_API_URL,
                        apiKey: EVOLUTION_GO_API_KEY,
                        isGo: true
                    };
                }
            }

            // Verificar se está na Evolution Padrão
            if (stdListRes.status === 'fulfilled') {
                const stdInstances = Array.isArray(stdListRes.value.data) ? stdListRes.value.data : [];
                const foundInStd = stdInstances.some((i: any) =>
                    (nameToMatch && (i.name || i.instanceName || '').toLowerCase().trim() === nameToMatch) ||
                    (tokenToMatch && (i.token || i.id || '').toLowerCase().trim() === tokenToMatch)
                );
                if (foundInStd) {
                    console.log(`🔌 [Evolution Config] Instância ${identifier.instanceName || identifier.token} auto-detectada no EVOLUTION PADRÃO`);
                    return {
                        url: EVOLUTION_API_URL,
                        apiKey: EVOLUTION_API_KEY,
                        isGo: false
                    };
                }
            }
        } catch (detectErr: any) {
            console.warn('⚠️ [Evolution Config] Erro na auto-detecção das instâncias:', detectErr.message);
        }
    }

    // Default fallback
    return {
        url: EVOLUTION_API_URL,
        apiKey: EVOLUTION_API_KEY,
        isGo: false
    };
}

async function resolveTargetName(requestedName: string, config: any) {
    try {
        const fetchInstancesList = async (activeConfig: any) => {
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

        const instances = await fetchInstancesList(config);
        const nameMatch = instances.find((i: any) =>
            (i.name || i.instanceName || '').toLowerCase() === requestedName.toLowerCase()
        );

        if (nameMatch) {
            return nameMatch.name || nameMatch.instanceName;
        }
        return requestedName;
    } catch (err: any) {
        console.error('Error resolving target name:', err.message);
        return requestedName;
    }
}

async function test() {
    const instanceName = 'CARLOS';
    const number = '558498071213'; // Number in user's modal: 5584998071213
    const companyId = '84d1586e-5d0c-456f-aa12-aefc5a9364a7';
    const mediaUrl = 'https://lucrocertovercel-11exnl53f-carloscletons-projects.vercel.app/api/fiscal-module/nfse/6a49095417170f0b5470d54b/pdf?companyId=84d1586e-5d0c-456f-aa12-aefc5a9364a7';

    console.log('1. Resolving Config dynamically...');
    const config = await getEvolutionConfig({ companyId, instanceName });
    console.log('Config resolved:', config);

    console.log('2. Resolving Target Name...');
    const targetName = await resolveTargetName(instanceName, config);
    console.log('Target name resolved:', targetName);

    console.log(`3. Sending Media Message to ${config.url}/message/sendMedia/${targetName}...`);
    try {
        const response = await axios.post(`${config.url}/message/sendMedia/${encodeURIComponent(targetName)}`, {
            number: number,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: 'Teste de envio',
            media: mediaUrl,
            fileName: 'NotaFiscal.pdf'
        }, {
            headers: {
                'apikey': config.apiKey,
                'Content-Type': 'application/json'
            }
        });
        console.log('Send Success! Response:', response.data);
    } catch (err: any) {
        console.error('Send Error status:', err.response?.status);
        console.error('Send Error detail:', JSON.stringify(err.response?.data, null, 2));
    }
}

test();
