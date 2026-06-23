import { useState, useEffect, useRef, useMemo } from 'react';
import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff, RefreshCw, Search, Mail, MessageCircle, Send, Globe, Check, X, ChevronRight, Info, Scale, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';
import { ResultModal } from '../ui/ResultModal';
import { DiagnosticModal } from '../ui/DiagnosticModal';
import { Tooltip } from '../ui/Tooltip';
import { API_BASE_URL } from '../../lib/constants';

const extractTecnoSpeedError = (err: any) => {
    const responseData = err.response?.data;
    
    if (responseData?.detail) {
        const detail = responseData.detail;
        if (detail?.error) return detail.error;
        if (detail?.message) return detail;
        return typeof detail === 'object' ? detail : { message: String(detail) };
    }
    
    if (responseData?.error) {
        if (typeof responseData.error === 'object') return responseData.error;
        return { message: responseData.error, data: responseData.data };
    }
    
    return { message: responseData?.message || err.message || 'Erro desconhecido' };
};

const extractNfeioError = (err: any) => {
    const responseStatus = err.response?.status;
    const responseData = err.response?.data;
    
    if (responseStatus === 404) {
        return {
            message: 'Município não homologado ou sem cobertura cadastrada na NFe.io.',
            data: responseData || { notFound: true }
        };
    }
    
    const detail = responseData?.detail || responseData;
    const message = responseData?.error || detail?.message || detail?.error || err.message;
    return {
        message: typeof message === 'string' ? message : 'Cidade não homologada ou sem cobertura na NFe.io.',
        data: responseData
    };
};


const formatDadosObrigatorios = (dados: any) => {
    if (!dados) return "Consulta não disponível";
    
    let campos: string[] = [];
    if (Array.isArray(dados.campos)) {
        campos = dados.campos;
    } else if (Array.isArray(dados)) {
        campos = dados;
    } else if (typeof dados === 'string') {
        return dados;
    }
    
    if (campos.length === 0) return "Consulta não disponível";
    
    const formatted = campos.map(c => {
        if (typeof c !== 'string') return String(c);
        
        const parts = c.split('.');
        if (parts.length === 2) {
            const section = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            let field = parts[1].replace(/([A-Z])/g, ' $1').trim();
            field = field.charAt(0).toUpperCase() + field.slice(1);
            
            if (field.toLowerCase() === 'cpf cnpj') field = 'CpfCnpj';
            
            return `${section} - ${field}`;
        }
        
        return c.charAt(0).toUpperCase() + c.slice(1);
    });
    
    const hasOnlyTomador = formatted.every(item => item.startsWith("Tomador - "));
    if (hasOnlyTomador && formatted.length > 0) {
        const list = formatted.map(item => item.replace("Tomador - ", ""));
        return `Tomador - ${list.join(', ')}`;
    }
    
    return formatted.join(', ');
};

export function FiscalSettings() {
    const { currentEntity, refresh: refreshEntity } = useEntity();
    const { companies, updateCompany } = useCompanies();
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [moduleEnabled, setModuleEnabled] = useState(false);
    const [uploadingCert, setUploadingCert] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [certPassword, setCertPassword] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [showNfeioApiKey, setShowNfeioApiKey] = useState(false);
    const [showWebhookToken, setShowWebhookToken] = useState(false);
    const [diagnostic, setDiagnostic] = useState<{
        isOpen: boolean;
        steps: { title: string; status: 'pending' | 'loading' | 'success' | 'error'; msg?: string }[];
        logs: string[];
    }>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_diag_${currentEntity.id}`) : null;
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return { isOpen: false, steps: [], logs: [] };
            }
        }
        return { isOpen: false, steps: [], logs: [] };
    });

    const [testingJson, setTestingJson] = useState(false);

    useEffect(() => {
        if (!currentEntity.id) return;
        if (diagnostic.isOpen) {
            sessionStorage.setItem(`fiscal_diag_${currentEntity.id}`, JSON.stringify(diagnostic));
        } else {
            sessionStorage.removeItem(`fiscal_diag_${currentEntity.id}`);
        }
    }, [diagnostic, currentEntity.id]);

    const [config, setConfig] = useState({
        cnpj: '',
        inscricao_estadual: '',
        inscricao_municipal: '',
        razao_social: '',
        nome_fantasia: '',
        email: '',
        telefone: '',
        endereco: {
            logradouro: '',
            numero: '',
            complemento: '',
            bairro: '',
            cidade: '',
            cep: '',
            codigoCidade: '',
            uf: ''
        },
        regime_tributario: '1', 
        tecnospeed_api_key: '',
        ambiente: 'homologacao',
        endpoint_homologacao: '',
        endpoint_producao: '',
        certificado_id: '',
        certificado_vencimento: '',
        certificado_sujeito: '',
        certificado_status: '',
        use_test_data: false,
        default_cnae: '',
        default_taxation_code: '',
        default_iss_aliquota: '',
        default_iss_exigibilidade: '1',
        default_iss_tipo: '7',
        send_email_automatically: false,
        send_whatsapp_automatically: false,
        nfse_nacional: false,
        default_regime_especial: '0',
        default_pis_aliquota: '',
        default_cofins_aliquota: '',
        default_csll_aliquota: '',
        default_irrf_aliquota: '',
        use_external_webhook: true,
        external_webhook_url: '',
        external_webhook_token: '',
        // Novos campos Simples Nacional
        simples_nacional_aliquota: '0.00',
        simples_nacional_regime_apuracao: '1',
        pis_cofins_situacao_tributaria: '00',
        pis_cofins_csll_retencao_tipo: '1',
        reforma_tributaria_calculadora_ativa: false,
        reforma_tributaria_ibs_aliquota: '0.10',
        reforma_tributaria_cbs_aliquota: '0.90'
    });

    const currentCompany = companies.find(c => c.id === currentEntity.id);

    const activeProvider = currentCompany?.settings?.fiscal_provider || 'tecnospeed';
    const enabledProviders = useMemo(() => {
        const list = currentCompany?.settings?.enabled_fiscal_providers;
        if (Array.isArray(list) && list.length > 0) return list;
        return [activeProvider || 'tecnospeed'];
    }, [currentCompany, activeProvider]);

    const [activeSubTab, setActiveSubTab] = useState<'tecnospeed' | 'nfeio' | 'other'>('tecnospeed');
    const [changingActiveProvider, setChangingActiveProvider] = useState(false);

    useEffect(() => {
        if (enabledProviders.includes(activeProvider)) {
            setActiveSubTab(activeProvider as any);
        } else if (enabledProviders.length > 0) {
            setActiveSubTab(enabledProviders[0] as any);
        }
    }, [activeProvider, enabledProviders]);

    const handleSelectActiveProvider = async (provider: string) => {
        if (!currentEntity.id || currentEntity.type === 'personal') return;
        setChangingActiveProvider(true);
        try {
            const updatedSettings = {
                ...(currentCompany?.settings || {}),
                fiscal_provider: provider
            };
            await updateCompany(currentEntity.id, {
                settings: updatedSettings
            });
            await refreshEntity();
        } catch (err) {
            console.error('Erro ao mudar provedor ativo:', err);
            alert('Não foi possível atualizar o emissor ativo.');
        } finally {
            setChangingActiveProvider(false);
        }
    };

    const [savingNfeio, setSavingNfeio] = useState(false);
    const [deletingCert, setDeletingCert] = useState(false);
    const [nfeioConfig, setNfeioConfig] = useState({
        apiKey: '',
        companyId: '',
        ambiente: 'homologacao',
        cnae: '',
        inscricaoMunicipal: '',
        aliquotaIss: '',
        simplesNacional: true,
        cityServiceCode: '',
        certificado_id: '',
        certificado_vencimento: '',
        certificado_sujeito: '',
        certificado_status: '',
        send_email_automatically: false,
        send_whatsapp_automatically: false,
        reforma_tributaria_calculadora_ativa: false,
        reforma_tributaria_ibs_aliquota: '0.10',
        reforma_tributaria_cbs_aliquota: '0.90'
    });

    const isDirty = useMemo(() => {
        if (!currentCompany) return false;
        if (!!currentCompany.fiscal_module_enabled !== moduleEnabled) return true;
        const savedConfig = currentCompany.tecnospeed_config || {};
        const keys = Object.keys(config) as (keyof typeof config)[];
        for (const key of keys) {
            if (key === 'endereco') {
                const savedEnd = savedConfig.endereco || {};
                const currEnd = config.endereco || {};
                const endKeys = Object.keys(currEnd) as (keyof typeof currEnd)[];
                for (const ek of endKeys) {
                    if (String(savedEnd[ek] || '') !== String(currEnd[ek] || '')) return true;
                }
            } else {
                const valA = String(savedConfig[key] || '').trim();
                const valB = String(config[key] || '').trim();
                if (valA !== valB) return true;
            }
        }
        return false;
    }, [config, moduleEnabled, currentCompany]);

    // Sincronizar configurações apenas quando a empresa MUDAR de fato (evitar loop)
    const lastCompanyId = useRef<string | null>(null);
    useEffect(() => {
        if (!currentCompany || lastCompanyId.current === currentCompany.id) return;
        lastCompanyId.current = currentCompany.id;

        setModuleEnabled(!!currentCompany.fiscal_module_enabled);
        setConfig((prev: any) => {
            const newConfig = { ...prev };
            const tc = currentCompany.tecnospeed_config || {};
            Object.assign(newConfig, tc);
            
            // ... resto das atribuições (removido para brevidade no diff, mas mantido no arquivo)
            if (newConfig.tecnospeed_api_key) newConfig.tecnospeed_api_key = newConfig.tecnospeed_api_key.trim();
            if (newConfig.endpoint_homologacao) newConfig.endpoint_homologacao = newConfig.endpoint_homologacao.toLowerCase();
            if (newConfig.endpoint_producao) newConfig.endpoint_producao = newConfig.endpoint_producao.toLowerCase();
            if (!newConfig.cnpj && currentCompany.cnpj) newConfig.cnpj = currentCompany.cnpj;
            if (!newConfig.razao_social && currentCompany.legal_name) newConfig.razao_social = currentCompany.legal_name;
            if (!newConfig.nome_fantasia && currentCompany.trade_name) newConfig.nome_fantasia = currentCompany.trade_name;
            if (!newConfig.telefone && currentCompany.phone) newConfig.telefone = currentCompany.phone;
            if (!newConfig.endereco) newConfig.endereco = {};
            if (!newConfig.endereco.logradouro && currentCompany.street) newConfig.endereco.logradouro = currentCompany.street;
            if (!newConfig.endereco.numero && currentCompany.number) newConfig.endereco.number = currentCompany.number;
            if (!newConfig.endereco.complemento && currentCompany.complement) newConfig.endereco.complemento = currentCompany.complement;
            if (!newConfig.endereco.bairro && currentCompany.neighborhood) newConfig.endereco.bairro = currentCompany.neighborhood;
            if (!newConfig.endereco.cidade && currentCompany.city) newConfig.endereco.cidade = currentCompany.city;
            if (!newConfig.endereco.cep && currentCompany.zip_code) newConfig.endereco.cep = currentCompany.zip_code;
            if (!newConfig.endereco.uf && currentCompany.state) newConfig.endereco.uf = currentCompany.state;

            if (newConfig.reforma_tributaria_ibs_aliquota === undefined) newConfig.reforma_tributaria_ibs_aliquota = '0.10';
            if (newConfig.reforma_tributaria_cbs_aliquota === undefined) newConfig.reforma_tributaria_cbs_aliquota = '0.90';
            if (newConfig.use_external_webhook === undefined) newConfig.use_external_webhook = true;

            return newConfig;
        });

        const nfe = currentCompany.settings?.nfeio_config || {};
        setNfeioConfig({
            apiKey: nfe.apiKey || '',
            companyId: nfe.companyId || '',
            ambiente: nfe.ambiente || 'homologacao',
            cnae: nfe.cnae || '',
            inscricaoMunicipal: nfe.inscricaoMunicipal || '',
            aliquotaIss: nfe.aliquotaIss || '',
            simplesNacional: nfe.simplesNacional !== undefined ? nfe.simplesNacional : true,
            cityServiceCode: nfe.cityServiceCode || '',
            certificado_id: nfe.certificado_id || '',
            certificado_vencimento: nfe.certificado_vencimento || '',
            certificado_sujeito: nfe.certificado_sujeito || '',
            certificado_status: nfe.certificado_status || '',
            send_email_automatically: nfe.send_email_automatically || false,
            send_whatsapp_automatically: nfe.send_whatsapp_automatically || false,
            reforma_tributaria_calculadora_ativa: nfe.reforma_tributaria_calculadora_ativa || false,
            reforma_tributaria_ibs_aliquota: nfe.reforma_tributaria_ibs_aliquota || '0.10',
            reforma_tributaria_cbs_aliquota: nfe.reforma_tributaria_cbs_aliquota || '0.90'
        });
    }, [currentCompany?.id]); // Depender apenas do ID

    const currentCertInfo = useMemo(() => {
        if (activeSubTab === 'nfeio') {
            return {
                id: nfeioConfig.certificado_id || '',
                status: nfeioConfig.certificado_status || '',
                vencimento: nfeioConfig.certificado_vencimento || '',
                sujeito: nfeioConfig.certificado_sujeito || '',
            };
        } else {
            return {
                id: config.certificado_id || '',
                status: config.certificado_status || '',
                vencimento: config.certificado_vencimento || '',
                sujeito: config.certificado_sujeito || '',
            };
        }
    }, [activeSubTab, nfeioConfig, config]);

    // Persistência do JSON do Laboratório
    const [testJson, setTestJson] = useState(() => {
        return localStorage.getItem('fiscal_lab_json') || '';
    });

    useEffect(() => {
        localStorage.setItem('fiscal_lab_json', testJson);
    }, [testJson]);

    const [resultModal, setResultModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'warning';
        data?: Record<string, any>;
        action?: {
            label: string;
            onClick: () => void;
        };
    }>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_result_modal_${currentEntity.id}`) : null;
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return { isOpen: false, title: '', message: '', type: 'info' };
            }
        }
        return { isOpen: false, title: '', message: '', type: 'info' };
    });
    const [lastTestResult, setLastTestResult] = useState<any>(null);

    // Cidades e Homologação TecnoSpeed
    const [searchUf, setSearchUf] = useState(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_searchUf_${currentEntity.id}`) : null;
        return saved || 'RN';
    });
    const [searchCityQuery, setSearchCityQuery] = useState(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_searchCityQuery_${currentEntity.id}`) : null;
        return saved || '';
    });
    const [citiesList, setCitiesList] = useState<{ id: string; nome: string }[]>([]);
    const [loadingCitiesList, setLoadingCitiesList] = useState(false);
    const [selectedSearchCity, setSelectedSearchCity] = useState<{ id: string; nome: string } | null>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_selectedSearchCity_${currentEntity.id}`) : null;
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }
        return null;
    });
    const [tecnoSpeedCityInfo, setTecnoSpeedCityInfo] = useState<any>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_tecnoSpeedCityInfo_${currentEntity.id}`) : null;
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }
        return null;
    });
    const [cityNotHomologatedMessage, setCityNotHomologatedMessage] = useState<string | null>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_cityNotHomologatedMessage_${currentEntity.id}`) : null;
        return saved || null;
    });
    const [searchingCityTecnoSpeed, setSearchingCityTecnoSpeed] = useState(false);
    const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
    const cityDropdownRef = useRef<HTMLDivElement>(null);
    const prevUfRef = useRef<string>(searchUf);

    // Estado e campos adicionais para as novas opções de busca (Mockup do usuário)
    const [searchMode, setSearchMode] = useState<'name' | 'ibge' | 'uf'>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_searchMode_${currentEntity.id}`) : null;
        return (saved as 'name' | 'ibge' | 'uf') || 'name';
    });
    const [searchIbgeQuery, setSearchIbgeQuery] = useState(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_searchIbgeQuery_${currentEntity.id}`) : null;
        return saved || '';
    });
    
    // Estados do Modal de visualização completa do Estado (UF)
    const [isStateModalOpen, setIsStateModalOpen] = useState(false);
    const [stateCitiesStatus, setStateCitiesStatus] = useState<Record<string, { loading: boolean; error?: string; data?: any; isNotHomologated?: boolean }>>({});
    const [verifyingAllStateCities, setVerifyingAllStateCities] = useState(false);
    const [verificationProgress, setVerificationProgress] = useState({ current: 0, total: 0 });
    const [stateModalFilterQuery, setStateModalFilterQuery] = useState('');

    // Cidades e Homologação NFe.io
    const [searchUfNfeio, setSearchUfNfeio] = useState(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_searchUfNfeio_${currentEntity.id}`) : null;
        return saved || 'PE';
    });
    const [searchCityQueryNfeio, setSearchCityQueryNfeio] = useState(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_searchCityQueryNfeio_${currentEntity.id}`) : null;
        return saved || '';
    });
    const [citiesListNfeio, setCitiesListNfeio] = useState<{ id: string; nome: string }[]>([]);
    const [loadingCitiesListNfeio, setLoadingCitiesListNfeio] = useState(false);
    const [selectedSearchCityNfeio, setSelectedSearchCityNfeio] = useState<{ id: string; nome: string } | null>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_selectedSearchCityNfeio_${currentEntity.id}`) : null;
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }
        return null;
    });
    const [nfeioCityInfo, setNfeioCityInfo] = useState<any>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_nfeioCityInfo_${currentEntity.id}`) : null;
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }
        return null;
    });
    const [nfeioCityNotCoveredMessage, setNfeioCityNotCoveredMessage] = useState<string | null>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_nfeioCityNotCoveredMessage_${currentEntity.id}`) : null;
        return saved || null;
    });
    const [searchingCityNfeio, setSearchingCityNfeio] = useState(false);
    const [isCityDropdownOpenNfeio, setIsCityDropdownOpenNfeio] = useState(false);
    const cityDropdownRefNfeio = useRef<HTMLDivElement>(null);
    const prevUfRefNfeio = useRef<string>(searchUfNfeio);

    const [searchModeNfeio, setSearchModeNfeio] = useState<'name' | 'ibge' | 'uf'>(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_searchModeNfeio_${currentEntity.id}`) : null;
        return (saved as 'name' | 'ibge' | 'uf') || 'name';
    });
    const [searchIbgeQueryNfeio, setSearchIbgeQueryNfeio] = useState(() => {
        const saved = typeof window !== 'undefined' && currentEntity.id ? sessionStorage.getItem(`fiscal_searchIbgeQueryNfeio_${currentEntity.id}`) : null;
        return saved || '';
    });

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(`fiscal_searchMode_${currentEntity.id}`, searchMode);
    }, [searchMode, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(`fiscal_searchIbgeQuery_${currentEntity.id}`, searchIbgeQuery);
    }, [searchIbgeQuery, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(`fiscal_searchModeNfeio_${currentEntity.id}`, searchModeNfeio);
    }, [searchModeNfeio, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(`fiscal_searchIbgeQueryNfeio_${currentEntity.id}`, searchIbgeQueryNfeio);
    }, [searchIbgeQueryNfeio, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(`fiscal_searchUfNfeio_${currentEntity.id}`, searchUfNfeio);
    }, [searchUfNfeio, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(`fiscal_searchCityQueryNfeio_${currentEntity.id}`, searchCityQueryNfeio);
    }, [searchCityQueryNfeio, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        if (selectedSearchCityNfeio) {
            sessionStorage.setItem(`fiscal_selectedSearchCityNfeio_${currentEntity.id}`, JSON.stringify(selectedSearchCityNfeio));
        } else {
            sessionStorage.removeItem(`fiscal_selectedSearchCityNfeio_${currentEntity.id}`);
        }
    }, [selectedSearchCityNfeio, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        if (nfeioCityInfo) {
            sessionStorage.setItem(`fiscal_nfeioCityInfo_${currentEntity.id}`, JSON.stringify(nfeioCityInfo));
        } else {
            sessionStorage.removeItem(`fiscal_nfeioCityInfo_${currentEntity.id}`);
        }
    }, [nfeioCityInfo, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        if (nfeioCityNotCoveredMessage) {
            sessionStorage.setItem(`fiscal_nfeioCityNotCoveredMessage_${currentEntity.id}`, nfeioCityNotCoveredMessage);
        } else {
            sessionStorage.removeItem(`fiscal_nfeioCityNotCoveredMessage_${currentEntity.id}`);
        }
    }, [nfeioCityNotCoveredMessage, currentEntity.id]);


    // Filtrar municípios no modal estadual
    const filteredStateCities = useMemo(() => {
        if (!stateModalFilterQuery.trim()) return citiesList;
        const cleanString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const target = cleanString(stateModalFilterQuery);
        return citiesList.filter(c => 
            cleanString(c.nome).includes(target) || 
            c.id.includes(target)
        );
    }, [citiesList, stateModalFilterQuery]);

    // Consultar cidade na TecnoSpeed usando o código IBGE diretamente
    const handleSearchCityByIbge = async (ibgeCode: string) => {
        if (!ibgeCode || ibgeCode.length !== 7) return;
        setSearchingCityTecnoSpeed(true);
        setTecnoSpeedCityInfo(null);
        setCityNotHomologatedMessage(null);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.consultarCidadeNotaNacional(ibgeCode, currentEntity.id!, token);
            setTecnoSpeedCityInfo(result.data || result);
        } catch (err: any) {
            const isExpectedApiError = err.response?.status === 400 || err.response?.status === 404;
            if (isExpectedApiError) {
                console.warn(`[PlugNotas] Cidade por IBGE ${ibgeCode} não homologada ou não cadastrada (HTTP ${err.response.status}).`);
            } else {
                console.error('Erro ao consultar cidade por IBGE na TecnoSpeed:', err);
            }
            const nestedError = extractTecnoSpeedError(err);
            
            if (nestedError && nestedError.data) {
                setTecnoSpeedCityInfo(nestedError.data);
                setCityNotHomologatedMessage(nestedError.message || 'Município não homologado na TecnoSpeed no momento.');
            } else {
                setResultModal({
                    isOpen: true,
                    title: 'Erro na Consulta por IBGE',
                    message: nestedError.message || 'Não foi possível obter os dados da cidade consultada.',
                    type: 'error',
                    data: nestedError.data ? {
                        'Dados Técnicos': nestedError.data
                    } : undefined
                });
            }
        } finally {
            setSearchingCityTecnoSpeed(false);
        }
    };

    // Verificar requisitos de uma única cidade dentro do Modal Estadual
    const handleVerifySingleCityInState = async (cityId: string, cityName: string) => {
        setStateCitiesStatus(prev => ({
            ...prev,
            [cityId]: { loading: true }
        }));
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = activeSubTab === 'nfeio'
                ? await fiscalService.consultarCidadeNfeio(cityId, currentEntity.id!, token)
                : await fiscalService.consultarCidadeNotaNacional(cityId, currentEntity.id!, token);
            const data = result.data || result;
            setStateCitiesStatus(prev => ({
                ...prev,
                [cityId]: { loading: false, data, isNotHomologated: false }
            }));
        } catch (err: any) {
            const isExpectedApiError = err.response?.status === 400 || err.response?.status === 404;
            if (isExpectedApiError) {
                console.warn(`[${activeSubTab === 'nfeio' ? 'NFe.io' : 'PlugNotas'}] Cidade ${cityName} (${cityId}) indisponível (HTTP ${err.response.status}).`);
            } else {
                console.error(`Erro ao consultar ${cityName} no estado:`, err);
            }
            const nestedError = activeSubTab === 'nfeio' ? extractNfeioError(err) : extractTecnoSpeedError(err);
            if (nestedError && nestedError.data) {
                setStateCitiesStatus(prev => ({
                    ...prev,
                    [cityId]: { 
                        loading: false, 
                        data: nestedError.data, 
                        isNotHomologated: true,
                        error: nestedError.message || 'Município sem cobertura/homologação'
                    }
                }));
            } else {
                setStateCitiesStatus(prev => ({
                    ...prev,
                    [cityId]: { 
                        loading: false, 
                        error: nestedError.message || 'Erro de conexão'
                    }
                }));
            }
        }
    };

    // Verificar todas as cidades do estado em lote, com delay de 80ms (Throttling contra rate limits)
    const handleVerifyAllStateCities = async () => {
        if (citiesList.length === 0 || verifyingAllStateCities) return;
        
        setVerifyingAllStateCities(true);
        setVerificationProgress({ current: 0, total: citiesList.length });
        
        const citiesToVerify = [...citiesList];
        
        let token = '';
        try {
            const session = await supabase.auth.getSession();
            token = session.data.session?.access_token || '';
        } catch (err) {
            console.error('Erro ao obter sessão para verificação em lote:', err);
        }

        if (!token) {
            setResultModal({
                isOpen: true,
                title: 'Erro na Sessão',
                message: 'Sessão expirada. Por favor, recarregue a página e tente novamente.',
                type: 'error'
            });
            setVerifyingAllStateCities(false);
            return;
        }

        // Loop sequencial com throttle
        for (let i = 0; i < citiesToVerify.length; i++) {
            let isStillVerifying = false;
            setVerifyingAllStateCities(prev => {
                isStillVerifying = prev;
                return prev;
            });
            if (!isStillVerifying) {
                break;
            }

            const city = citiesToVerify[i];
            
            const currentStatus = stateCitiesStatus[city.id];
            if (currentStatus && currentStatus.data && !currentStatus.error) {
                setVerificationProgress(prev => ({ ...prev, current: i + 1 }));
                continue;
            }

            setStateCitiesStatus(prev => ({
                ...prev,
                [city.id]: { loading: true }
            }));

            try {
                const result = activeSubTab === 'nfeio'
                    ? await fiscalService.consultarCidadeNfeio(city.id, currentEntity.id!, token)
                    : await fiscalService.consultarCidadeNotaNacional(city.id, currentEntity.id!, token);
                const data = result.data || result;
                setStateCitiesStatus(prev => ({
                    ...prev,
                    [city.id]: { loading: false, data, isNotHomologated: false }
                }));
            } catch (err: any) {
                const isExpectedApiError = err.response?.status === 400 || err.response?.status === 404;
                if (isExpectedApiError) {
                    console.warn(`[${activeSubTab === 'nfeio' ? 'NFe.io' : 'PlugNotas'}] Cidade ${city.nome} (${city.id}) indisponível no lote (HTTP ${err.response.status}).`);
                } else {
                    console.error(`Erro ao consultar ${city.nome} no lote:`, err);
                }
                const nestedError = activeSubTab === 'nfeio' ? extractNfeioError(err) : extractTecnoSpeedError(err);
                if (nestedError && nestedError.data) {
                    setStateCitiesStatus(prev => ({
                        ...prev,
                        [city.id]: { 
                            loading: false, 
                            data: nestedError.data, 
                            isNotHomologated: true,
                            error: nestedError.message || 'Município sem cobertura/homologação'
                        }
                    }));
                } else {
                    setStateCitiesStatus(prev => ({
                        ...prev,
                        [city.id]: { 
                            loading: false, 
                            error: nestedError.message || 'Erro de conexão'
                        }
                    }));
                }
            }

            setVerificationProgress(prev => ({ ...prev, current: i + 1 }));
            await new Promise(resolve => setTimeout(resolve, 80));
        }

        setVerifyingAllStateCities(false);
    };

    // Consultar cidade na NFe.io usando o ID/código IBGE
    const handleSearchCityNfeio = async () => {
        if (!selectedSearchCityNfeio) return;
        setSearchingCityNfeio(true);
        setNfeioCityInfo(null);
        setNfeioCityNotCoveredMessage(null);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.consultarCidadeNfeio(selectedSearchCityNfeio.id, currentEntity.id!, token);
            setNfeioCityInfo(result.data || result);
        } catch (err: any) {
            const isExpectedApiError = err.response?.status === 400 || err.response?.status === 404;
            if (isExpectedApiError) {
                console.warn(`[NFe.io] Cidade ${selectedSearchCityNfeio.nome} (${selectedSearchCityNfeio.id}) sem cobertura (HTTP ${err.response.status}).`);
            } else {
                console.error('Erro ao consultar cidade na NFe.io:', err);
            }
            const nestedError = extractNfeioError(err);
            
            if (nestedError && nestedError.data) {
                setNfeioCityInfo(nestedError.data);
                setNfeioCityNotCoveredMessage(nestedError.message || 'Município sem cobertura na NFe.io no momento.');
            } else {
                setResultModal({
                    isOpen: true,
                    title: 'Erro na Consulta NFe.io',
                    message: nestedError.message || 'Não foi possível obter os dados da cidade consultada.',
                    type: 'error',
                    data: nestedError.data ? {
                        'Dados Técnicos': nestedError.data
                    } : undefined
                });
            }
        } finally {
            setSearchingCityNfeio(false);
        }
    };

    // Consultar cidade na NFe.io usando o código IBGE diretamente
    const handleSearchCityByIbgeNfeio = async (ibgeCode: string) => {
        if (!ibgeCode || ibgeCode.length !== 7) return;
        setSearchingCityNfeio(true);
        setNfeioCityInfo(null);
        setNfeioCityNotCoveredMessage(null);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.consultarCidadeNfeio(ibgeCode, currentEntity.id!, token);
            setNfeioCityInfo(result.data || result);
        } catch (err: any) {
            const isExpectedApiError = err.response?.status === 400 || err.response?.status === 404;
            if (isExpectedApiError) {
                console.warn(`[NFe.io] Cidade por IBGE ${ibgeCode} sem cobertura (HTTP ${err.response.status}).`);
            } else {
                console.error('Erro ao consultar cidade por IBGE na NFe.io:', err);
            }
            const nestedError = extractNfeioError(err);
            
            if (nestedError && nestedError.data) {
                setNfeioCityInfo(nestedError.data);
                setNfeioCityNotCoveredMessage(nestedError.message || 'Município sem cobertura na NFe.io no momento.');
            } else {
                setResultModal({
                    isOpen: true,
                    title: 'Erro na Consulta por IBGE NFe.io',
                    message: nestedError.message || 'Não foi possível obter os dados da cidade consultada.',
                    type: 'error',
                    data: nestedError.data ? {
                        'Dados Técnicos': nestedError.data
                    } : undefined
                });
            }
        } finally {
            setSearchingCityNfeio(false);
        }
    };


    // Detect click outside city dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
                setIsCityDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(`fiscal_searchUf_${currentEntity.id}`, searchUf);
    }, [searchUf, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        sessionStorage.setItem(`fiscal_searchCityQuery_${currentEntity.id}`, searchCityQuery);
    }, [searchCityQuery, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        if (selectedSearchCity) {
            sessionStorage.setItem(`fiscal_selectedSearchCity_${currentEntity.id}`, JSON.stringify(selectedSearchCity));
        } else {
            sessionStorage.removeItem(`fiscal_selectedSearchCity_${currentEntity.id}`);
        }
    }, [selectedSearchCity, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        if (tecnoSpeedCityInfo) {
            sessionStorage.setItem(`fiscal_tecnoSpeedCityInfo_${currentEntity.id}`, JSON.stringify(tecnoSpeedCityInfo));
        } else {
            sessionStorage.removeItem(`fiscal_tecnoSpeedCityInfo_${currentEntity.id}`);
        }
    }, [tecnoSpeedCityInfo, currentEntity.id]);

    useEffect(() => {
        if (!currentEntity.id) return;
        if (cityNotHomologatedMessage) {
            sessionStorage.setItem(`fiscal_cityNotHomologatedMessage_${currentEntity.id}`, cityNotHomologatedMessage);
        } else {
            sessionStorage.removeItem(`fiscal_cityNotHomologatedMessage_${currentEntity.id}`);
        }
    }, [cityNotHomologatedMessage, currentEntity.id]);

    // Carregar a lista de cidades do estado (UF) selecionado através do IBGE
    useEffect(() => {
        const fetchCitiesForUf = async () => {
            if (!searchUf) return;
            setLoadingCitiesList(true);
            
            // Só limpa se a UF realmente mudou no dropdown e não é o carregamento inicial (que restaurou do sessionStorage)
            if (prevUfRef.current !== searchUf) {
                const savedUf = sessionStorage.getItem(`fiscal_searchUf_${currentEntity.id}`);
                if (searchUf !== savedUf) {
                    setSelectedSearchCity(null);
                    setSearchCityQuery('');
                    setTecnoSpeedCityInfo(null);
                    setCityNotHomologatedMessage(null);
                }
            }
            prevUfRef.current = searchUf;
            
            try {
                const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${searchUf.trim().toUpperCase()}/municipios`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    const sorted = data.map((c: any) => ({
                        id: String(c.id),
                        nome: c.nome
                    })).sort((a, b) => a.nome.localeCompare(b.nome));
                    setCitiesList(sorted);
                }
            } catch (err) {
                console.error('Erro ao buscar cidades do IBGE:', err);
            } finally {
                setLoadingCitiesList(false);
            }
        };
        fetchCitiesForUf();
    }, [searchUf, currentEntity.id]);

    // Filtrar cidades com base na query de digitação do usuário
    const filteredCities = useMemo(() => {
        if (!searchCityQuery.trim()) return citiesList;
        const cleanString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const target = cleanString(searchCityQuery);
        return citiesList.filter(c => cleanString(c.nome).includes(target));
    }, [citiesList, searchCityQuery]);

    // Carregar a lista de cidades do estado (UF) selecionado para NFe.io
    useEffect(() => {
        const fetchCitiesForUfNfeio = async () => {
            if (!searchUfNfeio) return;
            setLoadingCitiesListNfeio(true);
            
            if (prevUfRefNfeio.current !== searchUfNfeio) {
                const savedUf = sessionStorage.getItem(`fiscal_searchUfNfeio_${currentEntity.id}`);
                if (searchUfNfeio !== savedUf) {
                    setSelectedSearchCityNfeio(null);
                    setSearchCityQueryNfeio('');
                    setNfeioCityInfo(null);
                    setNfeioCityNotCoveredMessage(null);
                }
            }
            prevUfRefNfeio.current = searchUfNfeio;
            
            try {
                const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${searchUfNfeio.trim().toUpperCase()}/municipios`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    const sorted = data.map((c: any) => ({
                        id: String(c.id),
                        nome: c.nome
                    })).sort((a, b) => a.nome.localeCompare(b.nome));
                    setCitiesListNfeio(sorted);
                }
            } catch (err) {
                console.error('Erro ao buscar cidades do IBGE para NFe.io:', err);
            } finally {
                setLoadingCitiesListNfeio(false);
            }
        };
        fetchCitiesForUfNfeio();
    }, [searchUfNfeio, currentEntity.id]);

    // Filtrar cidades com base na query de digitação do usuário para NFe.io
    const filteredCitiesNfeio = useMemo(() => {
        if (!searchCityQueryNfeio.trim()) return citiesListNfeio;
        const cleanString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const target = cleanString(searchCityQueryNfeio);
        return citiesListNfeio.filter(c => cleanString(c.nome).includes(target));
    }, [citiesListNfeio, searchCityQueryNfeio]);

    // Detect click outside city dropdown for NFe.io to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (cityDropdownRefNfeio.current && !cityDropdownRefNfeio.current.contains(event.target as Node)) {
                setIsCityDropdownOpenNfeio(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    const handleSearchCityTecnoSpeed = async () => {
        if (!selectedSearchCity) return;
        setSearchingCityTecnoSpeed(true);
        setTecnoSpeedCityInfo(null);
        setCityNotHomologatedMessage(null);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.consultarCidadeNotaNacional(selectedSearchCity.id, currentEntity.id!, token);
            setTecnoSpeedCityInfo(result.data || result);
        } catch (err: any) {
            const isExpectedApiError = err.response?.status === 400 || err.response?.status === 404;
            if (isExpectedApiError) {
                console.warn(`[PlugNotas] Cidade ${selectedSearchCity.nome} (${selectedSearchCity.id}) não homologada (HTTP ${err.response.status}).`);
            } else {
                console.error('Erro ao consultar cidade na TecnoSpeed:', err);
            }
            const nestedError = extractTecnoSpeedError(err);
            
            if (nestedError && nestedError.data) {
                // É um erro contendo os metadados da cidade (ex: Não Homologada)
                setTecnoSpeedCityInfo(nestedError.data);
                setCityNotHomologatedMessage(nestedError.message || 'Município não homologado na TecnoSpeed no momento.');
            } else {
                // Outro erro de conexão ou genérico
                setResultModal({
                    isOpen: true,
                    title: 'Erro na Consulta',
                    message: nestedError.message || 'Não foi possível obter os dados da cidade consultada.',
                    type: 'error',
                    data: nestedError.data ? {
                        'Dados Técnicos': nestedError.data
                    } : undefined
                });
            }
        } finally {
            setSearchingCityTecnoSpeed(false);
        }
    };



    useEffect(() => {
        if (!currentEntity.id) return;
        if (resultModal.isOpen) {
            sessionStorage.setItem(`fiscal_result_modal_${currentEntity.id}`, JSON.stringify(resultModal));
        } else {
            sessionStorage.removeItem(`fiscal_result_modal_${currentEntity.id}`);
        }
    }, [resultModal, currentEntity.id]);

    const handleSave = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            setResultModal({
                isOpen: true,
                title: 'Aviso',
                message: 'Configurações fiscais são exclusivas para empresas. Mude o contexto no topo.',
                type: 'info'
            });
            return;
        }
        setSaving(true);
        try {
            await updateCompany(currentEntity.id, {
                tecnospeed_config: config,
                fiscal_module_enabled: moduleEnabled
            });
            
            // 🔄 Invalida e limpa o cache do backend chamando save-config
            try {
                const session = await supabase.auth.getSession();
                const token = session.data.session?.access_token;
                if (token) {
                    await fiscalService.saveConfig(currentEntity.id, config, token);
                    console.log('⚡ [FISCAL-SETTINGS] Cache do backend limpo com sucesso.');
                }
            } catch (cacheErr) {
                console.warn('⚠️ [FISCAL-SETTINGS] Erro não crítico ao notificar backend sobre nova config:', cacheErr);
            }

            await refreshEntity();
            setResultModal({
                isOpen: true,
                title: 'Sucesso',
                message: 'As configurações fiscais foram salvas corretamente.',
                type: 'success'
            });
        } catch (error) {
            console.error(error);
            setResultModal({
                isOpen: true,
                title: 'Erro ao Salvar',
                message: 'Não foi possível salvar as configurações locais.',
                type: 'error'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNfeio = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            setResultModal({
                isOpen: true,
                title: 'Aviso',
                message: 'Configurações fiscais são exclusivas para empresas. Mude o contexto no topo.',
                type: 'info'
            });
            return;
        }
        setSavingNfeio(true);
        try {
            const updatedSettings = {
                ...(currentCompany?.settings || {}),
                nfeio_config: nfeioConfig
            };
            await updateCompany(currentEntity.id, {
                settings: updatedSettings,
                fiscal_module_enabled: moduleEnabled
            });
            await refreshEntity();
            setResultModal({
                isOpen: true,
                title: 'Sucesso',
                message: 'As configurações da NFe.io foram salvas com sucesso.',
                type: 'success'
            });
        } catch (error) {
            console.error(error);
            setResultModal({
                isOpen: true,
                title: 'Erro ao Salvar',
                message: 'Não foi possível salvar as configurações da NFe.io.',
                type: 'error'
            });
        } finally {
            setSavingNfeio(false);
        }
    };

    const handleUploadCertificate = async () => {
        const file = fileInputRef.current?.files?.[0];
        
        if (!currentEntity.id || currentEntity.type === 'personal' || !file || !certPassword) {
            setResultModal({
                isOpen: true,
                title: 'Dados Incompletos',
                message: currentEntity.type === 'personal' 
                    ? 'O Certificado Digital deve ser vinculado a uma empresa. Mude o contexto no topo.'
                    : 'Selecione o arquivo e informe a senha do certificado.',
                type: 'info'
            });
            return;
        }

        setUploadingCert(true);
        const isNfeio = activeSubTab === 'nfeio';
        const isExternal = !!config.use_external_webhook;
        const targetProviderName = isNfeio ? 'NFe.io' : (isExternal ? 'Webhook Externo' : 'TecnoSpeed');

        setDiagnostic({
            isOpen: true,
            steps: [
                { title: 'Validando dados locais', status: 'loading' },
                { title: 'Autenticando sessão', status: 'pending' },
                { title: 'Enviando para Backend', status: 'pending' },
                { title: `Processando na ${targetProviderName}`, status: 'pending' }
            ],
            logs: [`Iniciando upload de ${file.name}`]
        });

        try {
            if (!certPassword) throw new Error('Senha do certificado não informada');
            
            let isSandbox = false;
            let baseUrl = '';
            let maskedKey = '';

            if (isNfeio) {
                isSandbox = nfeioConfig.ambiente === 'homologacao';
                baseUrl = `https://api.nfse.io/v2/companies/${nfeioConfig.companyId}/certificates`;
                maskedKey = nfeioConfig.apiKey ? `${nfeioConfig.apiKey.substring(0, 4)}...${nfeioConfig.apiKey.substring(nfeioConfig.apiKey.length - 4)}` : 'NÃO INFORMADA';
            } else {
                isSandbox = config.ambiente === 'homologacao';
                const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
                baseUrl = isExternal ? config.external_webhook_url : (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();
                maskedKey = isExternal ? 'AUTORIZAÇÃO WEBHOOK' : (config.tecnospeed_api_key ? `${config.tecnospeed_api_key.substring(0, 4)}...${config.tecnospeed_api_key.substring(config.tecnospeed_api_key.length - 4)}` : 'NÃO INFORMADA');
            }

            setDiagnostic(prev => ({
                ...prev,
                steps: prev.steps.map((s, i) => i === 0 ? { ...s, status: 'success' } : i === 1 ? { ...s, status: 'loading' } : s),
                logs: [
                    ...prev.logs, 
                    'Dados locais validados',
                    `Ambiente: ${isExternal ? 'INTEGRAÇÃO EXTERNA (WEBHOOK)' : (isSandbox ? 'HOMOLOGACAO' : 'PRODUCAO')}`,
                    `URL Alvo: ${baseUrl}`,
                    `API Key: ${maskedKey}`
                ]
            }));

            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            setDiagnostic(prev => ({
                ...prev,
                steps: prev.steps.map((s, i) => i === 1 ? { ...s, status: 'success' } : i === 2 ? { ...s, status: 'loading' } : s),
                logs: [...prev.logs, 'Sessão autenticada']
            }));

            const response = await fiscalService.uploadCertificate(currentEntity.id, file, certPassword, token, config, activeSubTab);
            
            if (isNfeio) {
                // Para NFe.io, o upload já realiza o vínculo. Finalizamos com sucesso direto!
                const updatedNfeConfig = {
                    ...nfeioConfig,
                    certificado_id: response.id,
                    certificado_vencimento: response.vencimento,
                    certificado_sujeito: response.sujeito,
                    certificado_status: 'ativo'
                };
                setNfeioConfig(updatedNfeConfig);

                setDiagnostic(prev => ({
                    ...prev,
                    steps: prev.steps.map((s, i) => i === 2 ? { ...s, status: 'success' } : i === 3 ? { ...s, status: 'success' } : s),
                    logs: [...prev.logs, 'Certificado processado e vinculado com sucesso na NFe.io!']
                }));
            } else {
                const targetLog = isExternal
                    ? 'Certificado recebido! Iniciando vínculo automático com o Webhook Externo...'
                    : 'Certificado recebido! Iniciando vínculo automático com a TecnoSpeed...';

                setDiagnostic(prev => ({
                    ...prev,
                    steps: prev.steps.map((s, i) => i === 2 ? { ...s, status: 'success' } : i === 3 ? { ...s, status: 'loading' } : s),
                    logs: [...prev.logs, targetLog]
                }));
                
                // Vincular automaticamente o certificado ao emitente
                try {
                    const syncResult = await fiscalService.syncIssuer(currentEntity.id, {
                        ...config,
                        certificado_id: response.id
                    }, token);

                    // ATUALIZAR ESTADO LOCAL IMEDIATAMENTE
                    const updatedConfig = {
                        ...config,
                        certificado_id: response.id,
                        certificado_vencimento: response.vencimento,
                        certificado_sujeito: response.sujeito,
                        certificado_status: 'ativo'
                    };
                    setConfig(updatedConfig);

                    setDiagnostic(prev => ({
                        ...prev,
                        steps: prev.steps.map((s, i) => i === 3 ? { ...s, status: 'success' } : s),
                        logs: [...prev.logs, 'Vínculo concluído com sucesso!', 'Resposta Sync: ' + JSON.stringify(syncResult)]
                    }));
                } catch (syncErr: any) {
                    console.warn('Falha no auto-sync, mas o certificado foi enviado:', syncErr);
                    
                    setConfig(prev => ({
                        ...prev,
                        certificado_id: response.id,
                        certificado_vencimento: response.vencimento,
                        certificado_sujeito: response.sujeito,
                        certificado_status: 'ativo'
                    }));

                    setDiagnostic(prev => ({
                        ...prev,
                        steps: prev.steps.map((s, i) => i === 3 ? { ...s, status: 'error', msg: 'Vínculo manual necessário' } : s),
                        logs: [...prev.logs, 'AVISO: O certificado subiu, mas falhou ao vincular automaticamente. Clique em "Sincronizar Emitente" manualmente.']
                    }));
                }
            }
            
            if (fileInputRef.current) fileInputRef.current.value = '';
            setCertPassword('');
            // REMOVIDO: await refreshEntity(); 
            // Movido para o clique do botão "Ver Resultado Final" no modal de diagnóstico
            // para evitar que o componente remonte e feche o modal sozinho.
        } catch (error: any) {
            console.error('Cert upload error:', error);
            const data = error.response?.data;
            const msg = data?.detail ? (typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail) : 
                        data?.error ? (typeof data.error === 'object' ? JSON.stringify(data.error) : data.error) : 
                        error.message;

            setDiagnostic(prev => ({
                ...prev,
                steps: prev.steps.map(s => s.status === 'loading' ? { ...s, status: 'error', msg } : s),
                logs: [...prev.logs, `ERRO CRÍTICO: ${msg}`]
            }));
        } finally {
            setUploadingCert(false);
        }
    };

    const handleDeleteCertificate = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') return;

        if (!window.confirm('Tem certeza de que deseja remover o certificado digital? A empresa ficará impossibilitada de emitir notas até que um novo certificado seja enviado.')) {
            return;
        }

        setDeletingCert(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const targetProvider = activeSubTab === 'nfeio' ? 'nfeio' : 'tecnospeed';

            await fiscalService.deleteCertificate(currentEntity.id, token, targetProvider);

            if (targetProvider === 'nfeio') {
                setNfeioConfig(prev => ({
                    ...prev,
                    certificado_id: '',
                    certificado_vencimento: '',
                    certificado_sujeito: '',
                    certificado_status: ''
                }));
            } else {
                setConfig(prev => ({
                    ...prev,
                    certificado_id: '',
                    certificado_vencimento: '',
                    certificado_sujeito: '',
                    certificado_status: ''
                }));
            }

            await refreshEntity();

            setResultModal({
                isOpen: true,
                title: 'Sucesso',
                message: 'O certificado digital foi removido com sucesso.',
                type: 'success'
            });
        } catch (error: any) {
            console.error('Erro ao excluir certificado:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Erro desconhecido';
            setResultModal({
                isOpen: true,
                title: 'Erro ao Remover',
                message: `Não foi possível remover o certificado: ${errorMsg}`,
                type: 'error'
            });
        } finally {
            setDeletingCert(false);
        }
    };

    const wrapFiscalLinks = (data: any, companyId: string, sessionToken?: string) => {
        if (!data || typeof data !== 'object') return data;
        
        const newData = Array.isArray(data) ? [...data] : { ...data };
        
        for (const key in newData) {
            const value = newData[key];
            
            if (typeof value === 'string' && value.includes('plugnotas.com.br')) {
                // Regex para capturar /nfse/pdf/ID ou /nfse-nacional/pdf/ID etc
                const match = value.match(/\/(nfse-nacional|nfse|nfe|nfce)\/(pdf|xml)\/([a-f0-9]+)/i);
                if (match) {
                    const [_, type, format, id] = match;
                    const base = API_BASE_URL.replace(/\/$/, '');
                    const tokenPart = sessionToken ? `&token=${sessionToken}` : '';
                    newData[key] = `${base}/fiscal-module/${type}/${id}/${format}?companyId=${companyId}${tokenPart}`;
                }
            } else if (typeof value === 'object') {
                newData[key] = wrapFiscalLinks(value, companyId, sessionToken);
            }
        }
        
        return newData;
    };

    const handleCheckTestStatus = async (id: string) => {
        if (!id || !currentEntity.id) return;
        setTestingJson(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const targetProvider = activeSubTab === 'nfeio' ? 'nfeio' : 'tecnospeed';
            const result = await fiscalService.checkStatus(id, currentEntity.id, token, targetProvider);
            const wrappedResult = wrapFiscalLinks(result, currentEntity.id, token);
            
            const rawStatus = (result.status || result.data?.status || result.flowStatus || '').toLowerCase();
            const isDone = ['concluido', 'autorizado', 'erro', 'rejeitado', 'issued', 'cancelled'].includes(rawStatus);
            const noteType = result.type || result.data?.type || 'nfse';

            let finalPdfUrl = null;
            let finalXmlUrl = null;

            // Injeção manual de links se concluído via download de blobs
            if (isDone && id) {
                try {
                    const pdfBlob = await fiscalService.downloadPDF(id, noteType, currentEntity.id, token, targetProvider);
                    finalPdfUrl = window.URL.createObjectURL(pdfBlob);
                } catch (pdfErr) {
                    console.error('[LabTest-Status] Erro ao buscar PDF:', pdfErr);
                }
                
                try {
                    const xmlBlob = await fiscalService.downloadXML(id, noteType, currentEntity.id, token, targetProvider);
                    finalXmlUrl = window.URL.createObjectURL(xmlBlob);
                } catch (xmlErr) {
                    console.error('[LabTest-Status] Erro ao buscar XML:', xmlErr);
                }
            }

            if (finalPdfUrl) {
                wrappedResult.pdf = { url: finalPdfUrl };
            }
            if (finalXmlUrl) {
                wrappedResult.xml = { url: finalXmlUrl };
            }

            const providerName = targetProvider === 'nfeio' ? 'NFe.io' : 'TecnoSpeed';

            setResultModal({
                isOpen: true,
                title: isDone ? 'Processamento Concluído' : 'Ainda em Processamento',
                message: isDone 
                    ? 'O status da nota foi atualizado.' 
                    : `A nota ainda está sendo processada pela ${providerName}. Tente novamente em instantes.`,
                type: isDone ? 'success' : 'info',
                data: wrappedResult,
                action: !isDone ? {
                    label: 'Verificar Novamente',
                    onClick: () => handleCheckTestStatus(id)
                } : undefined
            });
            setLastTestResult(wrappedResult);
        } catch (error: any) {
            console.error(error);
            setResultModal({
                isOpen: true,
                title: 'Erro na Consulta',
                message: error.message || 'Falha ao buscar status atualizado.',
                type: 'error'
            });
        } finally {
            setTestingJson(false);
        }
    };

    const handleTestJson = async () => {
        if (!testJson.trim()) return;
        
        if (activeSubTab === 'tecnospeed' && isDirty) {
            setResultModal({
                isOpen: true,
                title: 'Alterações não Salvas',
                message: 'Você possui alterações pendentes nas configurações. Por favor, salve as configurações (no botão azul ou no banner de aviso) antes de executar o teste para garantir que a nota seja emitida com os dados corretos.',
                type: 'info',
                action: {
                    label: 'Salvar Agora',
                    onClick: async () => {
                        setResultModal(prev => ({ ...prev, isOpen: false }));
                        await handleSave();
                    }
                }
            });
            return;
        }

        setTestingJson(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const payload = JSON.parse(testJson);
            const targetProvider = activeSubTab === 'nfeio' ? 'nfeio' : 'tecnospeed';
            const response = await fiscalService.emitirNFSe(currentEntity.id!, payload, token, undefined, true, targetProvider);
            const wrappedResponse = wrapFiscalLinks(response, currentEntity.id!, token);
            
            // Detecção ultra-robusta de ID e Status (Tratando documentos, data, Array ou Objeto)
            const doc = response.documents?.[0] || 
                       (Array.isArray(response) ? response[0] : 
                       (Array.isArray(response.data) ? response.data[0] : 
                       (response.data || response)));
            
            const externalId = doc?.id || doc?.protocolo || response.id || response.protocolo || response.data?.id;
            
            const fullResponseString = JSON.stringify(response).toLowerCase();
            // Melhor detecção de processamento: só é processado se explicitamente dito ou se não houver confirmação de autorização/erro
            const isDone = fullResponseString.includes('autorizada') || 
                           fullResponseString.includes('concluido') || 
                           fullResponseString.includes('erro') || 
                           fullResponseString.includes('rejeitado') ||
                           fullResponseString.includes('issued') ||
                           fullResponseString.includes('cancelled');
            
            const isProcessing = !isDone && (
                                fullResponseString.includes('processamento') || 
                                fullResponseString.includes('processing') || 
                                doc?.status === 'processando' ||
                                response.status === 'processando' ||
                                fullResponseString.includes('waitingcalculatetaxes') ||
                                fullResponseString.includes('waitingsend'));

            console.log('🧪 [LAB-DEBUG] Resposta Emissão:', { externalId, isProcessing, response });

            let finalPdfUrl = null;
            let finalXmlUrl = null;

            // Injeção manual de links se concluído via download de blobs
            if (isDone && externalId) {
                try {
                    const pdfBlob = await fiscalService.downloadPDF(externalId, 'nfse', currentEntity.id!, token, targetProvider);
                    finalPdfUrl = window.URL.createObjectURL(pdfBlob);
                } catch (pdfErr) {
                    console.error('[LabTest-Emit] Erro ao buscar PDF:', pdfErr);
                }
                
                try {
                    const xmlBlob = await fiscalService.downloadXML(externalId, 'nfse', currentEntity.id!, token, targetProvider);
                    finalXmlUrl = window.URL.createObjectURL(xmlBlob);
                } catch (xmlErr) {
                    console.error('[LabTest-Emit] Erro ao buscar XML:', xmlErr);
                }
            }

            if (finalPdfUrl) {
                wrappedResponse.pdf = { url: finalPdfUrl };
            }
            if (finalXmlUrl) {
                wrappedResponse.xml = { url: finalXmlUrl };
            }

            setResultModal({
                isOpen: true,
                title: isProcessing ? 'Nota em Processamento' : 'Emissão Concluída',
                message: isProcessing 
                    ? 'A nota foi enviada e está na fila da prefeitura. Aguarde alguns instantes e verifique o status novamente.' 
                    : 'A nota foi autorizada! Se o PDF der erro ao abrir, aguarde 5 a 10 segundos e tente novamente (é o tempo da prefeitura gerar o arquivo).',
                type: isProcessing ? 'warning' : 'success',
                data: wrappedResponse,
                action: externalId ? {
                    label: isProcessing ? '🔍 Verificar Status Agora' : '🔄 Atualizar Dados',
                    onClick: () => handleCheckTestStatus(externalId)
                } : undefined
            });
            setLastTestResult(wrappedResponse);
        } catch (error: any) {
            console.error(error);
            const isAlreadyEmitted = error.response?.status === 409;
            const conflictId = error.response?.data?.id || error.response?.data?.data?.id || error.response?.data?.detail?.id;
            
            const rawMessage = 
                (typeof error.response?.data?.error === 'string' ? error.response.data.error : undefined) ||
                error.response?.data?.error?.message || 
                error.response?.data?.message || 
                error.response?.data?.detail || 
                error.message;
            const safeMessage = typeof rawMessage === 'object' ? JSON.stringify(rawMessage) : String(rawMessage || '');
            const isInactiveDocError = safeMessage.includes('Documento não está ativo para este emissor');
            
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            setResultModal({
                isOpen: true,
                title: isAlreadyEmitted ? 'Nota Já Emitida' : (isInactiveDocError ? 'CNPJ Não Habilitado na TecnoSpeed' : 'Erro no Teste'),
                message: isAlreadyEmitted 
                    ? 'Esta nota já foi processada e autorizada anteriormente pela TecnoSpeed.' 
                    : isInactiveDocError
                        ? 'A TecnoSpeed rejeitou a nota. Para resolver, acesse seu painel do PlugNotas (Homologação), vá em "Empresas", clique em "Nova Empresa" e cadastre o CNPJ de teste (ex: 08.187.168/0001-60) para liberar as emissões.'
                        : (safeMessage || 'Erro ao processar o JSON ou na emissão.'),
                type: isAlreadyEmitted ? 'info' : 'error',
                data: error.response?.data ? wrapFiscalLinks(error.response.data, currentEntity.id!, token || undefined) : undefined,
                action: isAlreadyEmitted && conflictId ? {
                    label: '🔍 Verificar Status da Nota',
                    onClick: () => handleCheckTestStatus(conflictId)
                } : undefined
            });
        } finally {
            setTestingJson(false);
        }
    };

    const handleFileJson = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setTestJson(ev.target?.result as string);
        };
        reader.readAsText(file);
    };

    const handleGenerateExample = () => {
        const isNfeio = activeSubTab === 'nfeio';
        const isTest = isNfeio ? true : config.use_test_data;
        const isNacional = isNfeio ? false : !!config.nfse_nacional;
        
        const effectiveCnpj = isTest ? "08187168000160" : (config.cnpj ? config.cnpj.replace(/\D/g, '') : "08187168000160");
        const effectiveCity = isNfeio
            ? (config.endereco?.codigoCidade || "3550308")
            : (isTest 
                ? (isNacional ? "3106200" : "4115200")
                : (config.endereco?.codigoCidade || (isNacional ? "3106200" : "4115200")));
        
        const effectiveUf = isNfeio
            ? (config.endereco?.uf || "SP")
            : (isTest 
                ? (isNacional ? "MG" : "PR")
                : (config.endereco?.uf || (isNacional ? "MG" : "PR")));

        const effectiveCityDesc = isNfeio
            ? (config.endereco?.cidade || "Sao Paulo")
            : (isTest
                ? (isNacional ? "Belo Horizonte" : "Maringa")
                : (config.endereco?.cidade || (isNacional ? "Belo Horizonte" : "Maringa")));

        const mock: any = [
            {
                idIntegracao: `TEST_${Date.now()}`,
                ...(isNacional ? { versao: "1.00" } : {}),
                emitente: {
                    tipo: 1,
                    codigoCidade: effectiveCity
                },
                prestador: {
                    cpfCnpj: effectiveCnpj,
                    inscricaoMunicipal: isNfeio
                        ? (nfeioConfig.inscricaoMunicipal || "123456")
                        : (isNacional 
                            ? (isTest ? "1234567" : (config.inscricao_municipal || "1234567"))
                            : (config.inscricao_municipal || "123456"))
                },
                tomador: {
                    cpfCnpj: isNfeio ? "00000000000191" : "99999999999999",
                    razaoSocial: "Empresa de Teste LTDA",
                    inscricaoMunicipal: "8214100099",
                    email: "teste@nfe.io",
                    endereco: {
                        descricaoCidade: effectiveCityDesc,
                        cep: isNfeio ? "01001000" : (isNacional ? "31000000" : "87020100"),
                        tipoLogradouro: "Rua",
                        logradouro: "Barao do rio branco",
                        tipoBairro: "Centro",
                        codigoCidade: effectiveCity,
                        complemento: "sala 01",
                        estado: effectiveUf,
                        numero: "1001",
                        bairro: "Centro"
                    }
                },
                servico: [
                    {
                        codigo: isNfeio 
                            ? (nfeioConfig.cityServiceCode || nfeioConfig.cnae || "1.01")
                            : (isNacional ? "010101" : "01.01"),
                        discriminacao: isNfeio ? "Prestação de serviço de teste via NFe.io" : "Descrição dos serviços prestados via Laboratório JSON",
                        iss: {
                            tipoTributacao: isNfeio ? 1 : (isNacional ? 1 : 6),
                            exigibilidade: 1,
                            retido: false,
                            aliquota: isNfeio ? parseFloat(nfeioConfig.aliquotaIss || '2.00') : (isNacional ? parseFloat(config.simples_nacional_aliquota || '2.00') : 2)
                        },
                        valor: {
                            servico: 100.00
                        },
                        quantidade: 1,
                        valorUnitario: 100.00,
                        tributacaoTotal: {
                            federal: {
                                valor: 0.90,
                                valorPercentual: 0.90
                            },
                            estadual: {
                                valor: 0.00,
                                valorPercentual: 0.00
                            },
                            municipal: {
                                valor: 0.10,
                                valorPercentual: 0.10
                            }
                        }
                    }
                ]
            }
        ];
        setTestJson(JSON.stringify(mock, null, 2));
    };

    const handleSyncIssuer = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            setResultModal({
                isOpen: true,
                title: 'Aviso',
                message: 'A sincronização de emitente é exclusiva para empresas.',
                type: 'info'
            });
            return;
        }

        if (isDirty) {
            setResultModal({
                isOpen: true,
                title: 'Alterações não Salvas',
                message: 'Você possui alterações pendentes nas configurações. Salve as configurações antes de realizar a sincronização para enviar as informações atualizadas para a TecnoSpeed.',
                type: 'info',
                action: {
                    label: 'Salvar Agora',
                    onClick: async () => {
                        setResultModal(prev => ({ ...prev, isOpen: false }));
                        await handleSave();
                    }
                }
            });
            return;
        }

        if (!config.cnpj || !config.tecnospeed_api_key) {
            setResultModal({
                isOpen: true,
                title: 'Dados Incompletos',
                message: 'CNPJ e API Key são obrigatórios para sincronizar.',
                type: 'info'
            });
            return;
        }

        setSyncing(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            await fiscalService.syncIssuer(currentEntity.id, config, token);
            // REMOVIDO: await refreshEntity(); - Evita fechar modal por remount
            
            setResultModal({
                isOpen: true,
                title: 'Sincronização Concluída',
                message: 'Os dados do emitente foram enviados para a TecnoSpeed.',
                type: 'success'
            });
        } catch (error: any) {
            console.error('Sync error:', error);
            const data = error.response?.data;
            const detail = data?.detail || data?.error || error.message;
            const msg = typeof detail === 'object' ? JSON.stringify(detail) : detail;
            
            setResultModal({
                isOpen: true,
                title: 'Erro na Sincronização',
                message: 'Ocorreu um erro ao vincular os dados com a TecnoSpeed.',
                type: 'error',
                data: {
                    'Detalhe Técnico': msg
                }
            });
        } finally {
            setSyncing(false);
        }
    };

    const [syncingNfeio, setSyncingNfeioIssuer] = useState(false);
    const [deactivating, setDeactivating] = useState(false);

    const handleSyncNfeioIssuer = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            setResultModal({
                isOpen: true,
                title: 'Aviso',
                message: 'A sincronização de emitente é exclusiva para empresas.',
                type: 'info'
            });
            return;
        }

        if (!nfeioConfig.apiKey) {
            setResultModal({
                isOpen: true,
                title: 'Dados Incompletos',
                message: 'A API Key da NFe.io é obrigatória para sincronizar.',
                type: 'info'
            });
            return;
        }

        setSyncingNfeioIssuer(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const syncResult = await fiscalService.syncIssuer(currentEntity.id, nfeioConfig, token);
            
            // Atualiza o companyId local se a API retornou um novo
            if (syncResult.companyId) {
                setNfeioConfig(prev => ({
                    ...prev,
                    companyId: syncResult.companyId
                }));
            }

            await refreshEntity();
            
            setResultModal({
                isOpen: true,
                title: 'Sincronização Concluída',
                message: 'Os dados do emitente foram sincronizados/cadastrados com sucesso na NFe.io.',
                type: 'success'
            });
        } catch (error: any) {
            console.error('NFe.io Sync error:', error);
            const data = error.response?.data;
            const detail = data?.detail || data?.error || error.message;
            const msg = typeof detail === 'object' ? JSON.stringify(detail) : detail;
            
            setResultModal({
                isOpen: true,
                title: 'Erro na Sincronização',
                message: 'Ocorreu um erro ao vincular os dados com a NFe.io.',
                type: 'error',
                data: {
                    'Detalhe Técnico': msg
                }
            });
        } finally {
            setSyncingNfeioIssuer(false);
        }
    };

    const handleDeactivateIssuer = async () => {
        if (!currentEntity.id || currentEntity.type === 'personal') {
            setResultModal({
                isOpen: true,
                title: 'Aviso',
                message: 'A desativação de emitente é exclusiva para empresas.',
                type: 'info'
            });
            return;
        }

        const companyId = currentEntity.id;
        const providerName = activeProvider === 'nfeio' ? 'NFe.io' : 'TecnoSpeed';

        setResultModal({
            isOpen: true,
            title: 'Confirmar Inativação',
            message: `Tem certeza que deseja inativar este emitente no provedor ${providerName}? Esta ação excluirá a empresa na API do provedor e desabilitará o módulo fiscal localmente.`,
            type: 'warning',
            action: {
                label: 'Confirmar Inativação',
                onClick: async () => {
                    setResultModal(prev => ({ ...prev, isOpen: false }));
                    setDeactivating(true);
                    try {
                        const session = await supabase.auth.getSession();
                        const token = session.data.session?.access_token;
                        if (!token) throw new Error('Sessão expirada.');

                        const response = await fiscalService.deactivateIssuer(companyId, token);
                        
                        await refreshEntity();

                        setResultModal({
                            isOpen: true,
                            title: 'Emitente Inativado',
                            message: response.message || `O emitente foi desativado com sucesso no provedor ${providerName}.`,
                            type: 'success'
                        });
                    } catch (error: any) {
                        console.error('Deactivate error:', error);
                        const data = error.response?.data;
                        const detail = data?.detail || data?.error || error.message;
                        const msg = typeof detail === 'object' ? JSON.stringify(detail) : detail;
                        
                        setResultModal({
                            isOpen: true,
                            title: 'Erro ao Inativar',
                            message: `Ocorreu um erro ao inativar o emitente no provedor ${providerName}.`,
                            type: 'error',
                            data: {
                                'Detalhe Técnico': msg
                            }
                        });
                    } finally {
                        setDeactivating(false);
                    }
                }
            }
        });
    };

    const [checkingStatus, setCheckingStatus] = useState(false);
    const [checkingCityNationalStatus, setCheckingCityNationalStatus] = useState(false);
    const [checkingNfeioStatus, setCheckingNfeioStatus] = useState(false);

    const handleCheckIssuerStatus = async () => {
        if (!currentEntity.id || !config.cnpj) {
            setResultModal({
                isOpen: true,
                title: 'CNPJ Requerido',
                message: 'Preencha o CNPJ para verificar o status.',
                type: 'info'
            });
            return;
        }

        setCheckingStatus(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.checkIssuerStatus(currentEntity.id, config.cnpj.replace(/\D/g, ''), token);
            
            const issuer = result.data;
            const cert = issuer?.certificado_detalhes || issuer?.certificado;
            
            // ATUALIZAÇÃO AUTOMÁTICA: Se encontramos dados novos, vamos atualizar o estado local
            if (cert && typeof cert === 'object') {
                const updatedConfig = {
                    ...config,
                    certificado_id: issuer.certificado || config.certificado_id,
                    certificado_vencimento: cert.vencimento || config.certificado_vencimento,
                    certificado_sujeito: cert.sujeito || cert.nome || config.certificado_sujeito,
                    certificado_status: 'ativo'
                };
                setConfig(updatedConfig);
                
                // Persistir no banco para não perder a informação do vencimento
                await updateCompany(currentEntity.id, {
                    tecnospeed_config: updatedConfig
                });
                await refreshEntity();

                setResultModal({
                    isOpen: true,
                    title: 'Emissor Encontrado',
                    message: 'Dados do emissor e certificado atualizados com sucesso.',
                    type: 'success',
                    data: {
                        'Certificado': cert.nome || cert.sujeito || cert.id,
                        'Vencimento': cert.vencimento ? new Date(cert.vencimento).toLocaleDateString('pt-BR') : 'Não informado',
                        'Status': 'Ativo'
                    }
                });
            } else if (issuer?.certificado) {
                setResultModal({
                    isOpen: true,
                    title: 'Vínculo Detectado',
                    message: 'O emissor possui um certificado vinculado, mas os detalhes (vencimento) não foram retornados pela API.',
                    type: 'info',
                    data: {
                        'ID Certificado': issuer.certificado,
                        'Status': 'Vinculado'
                    }
                });
            } else {
                setResultModal({
                    isOpen: true,
                    title: 'Sem Certificado',
                    message: 'A empresa foi encontrada na TecnoSpeed, mas não há um certificado digital vinculado a este CNPJ.',
                    type: 'info'
                });
            }
        } catch (error: any) {
            console.error('Check status error:', error);
            const data = error.response?.data;
            const detail = data?.detail || data?.error || error.message;
            const msg = typeof detail === 'object' ? JSON.stringify(detail) : detail;
            
            setResultModal({
                isOpen: true,
                title: 'Erro na Consulta',
                message: 'Não foi possível obter o status do emissor.',
                type: 'error',
                data: {
                    'Detalhe Técnico': msg
                }
            });
        } finally {
            setCheckingStatus(false);
        }
    };

    const handleCheckNfeioIssuerStatus = async () => {
        if (!currentEntity.id || !nfeioConfig.companyId || !nfeioConfig.apiKey) {
            setResultModal({
                isOpen: true,
                title: 'Configurações Requeridas',
                message: 'Preencha a API Key e o ID da Empresa da NFe.io para verificar o status.',
                type: 'info'
            });
            return;
        }

        setCheckingNfeioStatus(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.checkNfeioCompanyStatus(currentEntity.id, token);
            const companyData = result.companies || result.company || result;
            
            const certificate = companyData.certificate;
            
            // Format certificate expiration date
            let vencimento = 'Nenhum certificado ativo';
            if (certificate && certificate.expiresOn) {
                const date = new Date(certificate.expiresOn);
                if (!isNaN(date.getTime())) {
                    vencimento = date.toLocaleDateString('pt-BR');
                }
            } else if (certificate && !certificate.expiresOn) {
                vencimento = 'Não informado';
            }

            const status = companyData.status || companyData.fiscalStatus || 'Ativo';
            const statusLabel = status === 'Active' ? 'Ativo ✅' : (status === 'Inactive' ? 'Inativo ❌' : status);
            const localId = nfeioConfig.certificado_id;
            const certStatusLabel = !certificate || certificate.status === 'None' || !certificate.status
                ? 'Nenhum Certificado ❌'
                : (certificate.status === 'Active' 
                    ? (localId ? 'Ativo ✅' : 'Excluído no Painel (Ativo na NFe.io) ⚠️') 
                    : (certificate.status === 'Pending' ? 'Pendente ⚠️' : certificate.status));

            setResultModal({
                isOpen: true,
                title: 'Status da Empresa na NFe.io',
                message: `Empresa encontrada com sucesso. Status de emissão: ${status === 'Active' ? 'Habilitada (Ativo)' : 'Desabilitada (Inativo)'}.`,
                type: status === 'Active' ? 'success' : 'warning',
                data: {
                    'Razão Social': companyData.name || 'Não informada',
                    'Nome Fantasia': companyData.tradeName || 'Não informado',
                    'CNPJ': companyData.federalTaxNumber ? String(companyData.federalTaxNumber).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : 'Não informado',
                    'Regime Tributário': companyData.taxRegime || 'Não informado',
                    'Status Cadastral': statusLabel,
                    'Status Certificado': certStatusLabel,
                    'Vencimento Certificado': vencimento,
                    'Certificado Local': localId ? 'Configurado ✅' : 'Removido ❌'
                }
            });
        } catch (error: any) {
            console.error('Check NFe.io status error:', error);
            const nestedError = extractNfeioError(error);
            
            setResultModal({
                isOpen: true,
                title: 'Erro ao Consultar Status NFe.io',
                message: nestedError.message || 'Não foi possível obter o status da empresa na NFe.io.',
                type: 'error',
                data: nestedError.data ? {
                    'Dados Retornados': nestedError.data
                } : undefined
            });
        } finally {
            setCheckingNfeioStatus(false);
        }
    };

    const handleCheckCityNationalStatus = async () => {
        const code = config.endereco?.codigoCidade;
        if (!code) {
            setResultModal({
                isOpen: true,
                title: 'Código IBGE Requerido',
                message: 'Por favor, preencha o Código IBGE da cidade nas configurações de endereço antes de realizar a consulta.',
                type: 'info'
            });
            return;
        }

        setCheckingCityNationalStatus(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const result = await fiscalService.consultarCidadeNotaNacional(code.replace(/\D/g, ''), currentEntity.id!, token);
            const cityData = result.data || result;
            const padraoNacional = cityData.padraoNacional;

            let message = '';
            let type: 'success' | 'error' | 'info' | 'warning' = 'info';

            if (padraoNacional) {
                const inProd = !!padraoNacional.producao;
                const inHomolog = !!padraoNacional.homologacao;

                if (inProd && inHomolog) {
                    message = `Ótima notícia! A cidade de ${cityData.nome || 'sua cidade'} (${cityData.uf || ''}) já trabalha 100% no padrão de Nota Nacional em Produção e Homologação.`;
                    type = 'success';
                } else if (inHomolog) {
                    message = `A cidade de ${cityData.nome || 'sua cidade'} (${cityData.uf || ''}) trabalha no padrão de Nota Nacional APENAS em Homologação (Ambiente de Testes). Ainda não disponível em Produção.`;
                    type = 'warning';
                } else {
                    message = `A cidade de ${cityData.nome || 'sua cidade'} (${cityData.uf || ''}) NÃO está habilitada para a Nota Nacional na TecnoSpeed no momento.`;
                    type = 'error';
                }
            } else {
                message = `A cidade de ${cityData.nome || 'sua cidade'} (${cityData.uf || ''}) NÃO trabalha com a Nota Nacional no momento (sem metadados de padrão nacional).`;
                type = 'error';
            }

            setResultModal({
                isOpen: true,
                title: 'Consulta Nota Nacional',
                message: message,
                type: type,
                data: {
                    'Município': `${cityData.nome || ''} - ${cityData.uf || ''}`,
                    'Padrão Local/Provedor': cityData.padrao || 'Não informado',
                    'Nota Nacional Homologação': padraoNacional?.homologacao ? 'Disponível ✅' : 'Indisponível ❌',
                    'Nota Nacional Produção': padraoNacional?.producao ? 'Disponível ✅' : 'Indisponível ❌',
                    'Exige Certificado': cityData.certificado ? 'Sim' : 'Não',
                    'Multisserviços': cityData.multiservicos ? 'Sim' : 'Não'
                }
            });
        } catch (error: any) {
            const isExpectedApiError = error.response?.status === 400 || error.response?.status === 404;
            if (isExpectedApiError) {
                console.warn(`[PlugNotas] Status de nota nacional indisponível para IBGE ${code.replace(/\D/g, '')} (HTTP ${error.response.status}).`);
            } else {
                console.error('Check city national status error:', error);
            }
            const nestedError = extractTecnoSpeedError(error);
            
            setResultModal({
                isOpen: true,
                title: 'Erro na Consulta',
                message: nestedError.message || 'Não foi possível verificar a disponibilidade da cidade no Padrão Nacional.',
                type: 'error',
                data: nestedError.data ? {
                    'Dados Retornados': nestedError.data
                } : undefined
            });
        } finally {
            setCheckingCityNationalStatus(false);
        }
    };

    const [isLookingUpIBGE, setIsLookingUpIBGE] = useState(false);

    const handleLookupIBGE = async () => {
        const { cidade, uf } = config.endereco;
        if (!cidade || !uf) {
            setResultModal({
                isOpen: true,
                title: 'Dados Incompletos',
                message: 'Preencha a Cidade e UF para buscar o código IBGE.',
                type: 'info'
            });
            return;
        }

        setIsLookingUpIBGE(true);
        try {
            // 1. Get State ID
            const statesRes = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados');
            const states = await statesRes.json();
            const state = states.find((s: any) => s.sigla.toUpperCase() === uf.toUpperCase());

            if (!state) throw new Error('UF não encontrada.');

            // 2. Get Cities for that State
            const citiesRes = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state.id}/municipios`);
            const cities = await citiesRes.json();
            
            // 3. Find matching city (case insensitive and removing accents)
            const city = cities.find((c: any) => 
                c.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
                cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            );

            if (city) {
                setConfig({
                    ...config,
                    endereco: {
                        ...config.endereco,
                        codigoCidade: city.id.toString()
                    }
                });
                setResultModal({
                    isOpen: true,
                    title: 'Código Encontrado',
                    message: `O código IBGE para ${city.nome} é ${city.id}.`,
                    type: 'success'
                });
            } else {
                throw new Error('Município não encontrado para esta UF.');
            }
        } catch (error: any) {
            setResultModal({
                isOpen: true,
                title: 'Erro na Busca',
                message: error.message || 'Não foi possível localizar o código IBGE.',
                type: 'error'
            });
        } finally {
            setIsLookingUpIBGE(false);
        }
    };

    return (
        <>
            {/* Módulo Toggle */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${moduleEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Status do Módulo Fiscal</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Ative para habilitar a emissão de notas e o menu lateral</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={moduleEnabled}
                            onChange={(e) => setModuleEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            <div className={`transition-opacity duration-200 ${moduleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
                {/* Active Provider Selector (Only shown if multiple are enabled) */}
                {enabledProviders.length > 1 && (
                    <div className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-slate-900/40 dark:to-purple-950/10 border border-indigo-100/80 dark:border-indigo-900/30 p-5 rounded-2xl mb-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Scale size={18} className="text-indigo-600 dark:text-indigo-400" />
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Emissor Fiscal Ativo</h4>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Selecione qual das tecnologias autorizadas será utilizada para emissão de notas fiscais:
                            </p>
                        </div>
                        <div className="flex gap-2 self-stretch md:self-auto bg-gray-100/80 dark:bg-slate-800/60 p-1 rounded-xl">
                            {enabledProviders.includes('tecnospeed') && (
                                <button
                                    type="button"
                                    disabled={changingActiveProvider}
                                    onClick={() => handleSelectActiveProvider('tecnospeed')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        activeProvider === 'tecnospeed'
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    TecnoSpeed
                                </button>
                            )}
                            {enabledProviders.includes('nfeio') && (
                                <button
                                    type="button"
                                    disabled={changingActiveProvider}
                                    onClick={() => handleSelectActiveProvider('nfeio')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        activeProvider === 'nfeio'
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    NFe.io
                                </button>
                            )}
                            {enabledProviders.includes('other') && (
                                <button
                                    type="button"
                                    disabled={changingActiveProvider}
                                    onClick={() => handleSelectActiveProvider('other')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                        activeProvider === 'other'
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }`}
                                >
                                    Outros
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Sub-tabs Navigation */}
                {enabledProviders.length > 1 && (
                    <div className="flex border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/20 p-1 rounded-xl gap-2 mb-6">
                        {enabledProviders.includes('tecnospeed') && (
                            <button
                                type="button"
                                onClick={() => setActiveSubTab('tecnospeed')}
                                className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeSubTab === 'tecnospeed'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/50'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-slate-800/30'
                                }`}
                            >
                                <Building2 size={16} />
                                TecnoSpeed
                                {activeProvider === 'tecnospeed' && (
                                    <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black lowercase tracking-normal">ativo</span>
                                )}
                            </button>
                        )}

                        {enabledProviders.includes('nfeio') && (
                            <button
                                type="button"
                                onClick={() => setActiveSubTab('nfeio')}
                                className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeSubTab === 'nfeio'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/50'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-slate-800/30'
                                }`}
                            >
                                <Send size={16} />
                                NFe.io
                                {activeProvider === 'nfeio' && (
                                    <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black lowercase tracking-normal">ativo</span>
                                )}
                            </button>
                        )}

                        {enabledProviders.includes('other') && (
                            <button
                                type="button"
                                onClick={() => setActiveSubTab('other')}
                                className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeSubTab === 'other'
                                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-200/50 dark:border-slate-700/50'
                                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-slate-800/30'
                                }`}
                            >
                                <Globe size={16} />
                                Outros
                                {activeProvider === 'other' && (
                                    <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 px-1.5 py-0.5 rounded font-black lowercase tracking-normal">ativo</span>
                                )}
                            </button>
                        )}
                    </div>
                )}

                {enabledProviders.length > 1 && activeSubTab !== activeProvider && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl flex items-start gap-3 mb-6">
                        <Info size={20} className="text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                        <div>
                            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Tecnologia Fiscal Inativa</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1 font-bold">Esta tecnologia não é a ativa no momento para sua empresa. O sistema continuará emitindo notas através de <strong>{activeProvider === 'tecnospeed' ? 'TecnoSpeed' : activeProvider === 'nfeio' ? 'NFe.io' : 'Outro Provedor'}</strong>. Você pode alterar o emissor ativo no painel de seleção acima.</p>
                        </div>
                    </div>
                )}

                {/* Sub-tab 1: TecnoSpeed */}
                {activeSubTab === 'tecnospeed' && (
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                        {isDirty && (
                            <div className="bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-900/30 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-700 dark:text-amber-400">
                                        <AlertCircle size={20} className="animate-bounce" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider leading-none">Alterações pendentes detectadas!</p>
                                        <p className="text-xs text-amber-700 dark:text-amber-500 font-bold mt-1">Você modificou as configurações. Clique em "Salvar" para aplicar as mudanças antes de testar ou sincronizar.</p>
                                    </div>
                                </div>
                                <Button 
                                    type="button" 
                                    onClick={handleSave} 
                                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-5 py-2.5 font-black uppercase text-[10px] tracking-widest shadow-md transition-all self-stretch sm:self-auto text-center justify-center"
                                >
                                    Salvar Agora
                                </Button>
                            </div>
                        )}
                        <div className="space-y-8">
                    <div className="flex items-start gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                        <Building2 className="text-indigo-600 mt-1" size={24} />
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configurações do Emitente</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Insira os dados da sua empresa exatamente como registrados na SEFAZ e Prefeitura.
                                Estes dados serão usados para preencher os campos do PlugNotas da TecnoSpeed.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="CNPJ do Emitente"
                            value={config.cnpj}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, cnpj: e.target.value })}
                            placeholder="00.000.000/0000-00"
                            autoComplete="off"
                        />
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Regime Tributário
                            </label>
                            <select
                                value={config.regime_tributario}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig({ ...config, regime_tributario: e.target.value })}
                                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoComplete="off"
                            >
                                <option value="1">Simples Nacional</option>
                                <option value="2">Simples Nacional (Excesso de Sublimite)</option>
                                <option value="3">Regime Normal (Lucro Real/Presumido)</option>
                                <option value="4">Microempreendedor Individual (MEI)</option>
                                <option value="5">Sociedade de Profissionais (Fixação de ISS)</option>
                            </select>
                        </div>
                        <Input
                            label="Razão Social"
                            value={config.razao_social}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, razao_social: e.target.value })}
                            placeholder="Sua Empresa LTDA"
                            autoComplete="off"
                        />
                        <Input
                            label="Nome Fantasia"
                            value={config.nome_fantasia}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, nome_fantasia: e.target.value })}
                            placeholder="Nome da sua loja/empresa"
                            autoComplete="off"
                        />
                        <Input
                            label="Inscrição Estadual"
                            value={config.inscricao_estadual}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, inscricao_estadual: e.target.value })}
                            placeholder="Isento ou Número"
                            autoComplete="off"
                        />
                        <Input
                            label="Inscrição Municipal"
                            value={config.inscricao_municipal}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, inscricao_municipal: e.target.value })}
                            placeholder="Obrigatório para NFS-e"
                            autoComplete="off"
                        />
                        <Input
                            label="E-mail"
                            type="email"
                            value={config.email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, email: e.target.value })}
                            placeholder="contato@empresa.com"
                            autoComplete="email"
                        />
                        <Input
                            label="Telefone"
                            value={config.telefone}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, telefone: e.target.value })}
                            placeholder="(00) 00000-0000"
                            autoComplete="tel"
                        />
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Endereço (Obrigatório)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Input
                                label="CEP"
                                value={config.endereco?.cep || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, cep: e.target.value } })}
                                placeholder="00000-000"
                                autoComplete="postal-code"
                            />
                            <div className="md:col-span-2">
                                <Input
                                    label="Logradouro"
                                    value={config.endereco?.logradouro || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, logradouro: e.target.value } })}
                                    placeholder="Rua, Avenida, etc."
                                    autoComplete="street-address"
                                />
                            </div>
                            <Input
                                label="Número"
                                value={config.endereco?.numero || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, numero: e.target.value } })}
                                placeholder="123"
                                autoComplete="off"
                            />
                            <div className="md:col-span-2">
                                <Input
                                    label="Complemento"
                                    value={config.endereco?.complemento || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, complemento: e.target.value } })}
                                    placeholder="Sala 1, Apto 2, etc."
                                    autoComplete="off"
                                />
                            </div>
                            <Input
                                label="Bairro"
                                value={config.endereco?.bairro || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, bairro: e.target.value } })}
                                placeholder="Centro"
                                autoComplete="off"
                            />
                            <Input
                                label="Cidade"
                                value={config.endereco?.cidade || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, cidade: e.target.value } })}
                                placeholder="Nome da cidade"
                                autoComplete="off"
                            />
                            <Input
                                label="UF"
                                value={config.endereco?.uf || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, uf: e.target.value } })}
                                placeholder="SP"
                                maxLength={2}
                                autoComplete="address-level1"
                            />
                            <div className="relative">
                                <Input
                                    label="Código Cidade (IBGE)"
                                    value={config.endereco?.codigoCidade || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, codigoCidade: e.target.value } })}
                                    placeholder="Ex: 3550308"
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    onClick={handleLookupIBGE}
                                    disabled={isLookingUpIBGE}
                                    className="absolute right-2 top-[32px] p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Buscar Código IBGE"
                                >
                                    {isLookingUpIBGE ? (
                                        <RefreshCw size={18} className="animate-spin" />
                                    ) : (
                                        <Search size={18} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Reforma Tributária (IBS/CBS) Section */}
                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                        <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10 dark:to-transparent rounded-2xl border border-emerald-500/20 dark:border-emerald-500/30 shadow-md backdrop-blur-md">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                                    <Scale size={24} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div>
                                            <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                Reforma Tributária 2026
                                            </span>
                                            <h4 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                                                Destaque Automático de IBS e CBS
                                            </h4>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={!!config.reforma_tributaria_calculadora_ativa}
                                                onChange={(e) => setConfig({ ...config, reforma_tributaria_calculadora_ativa: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-2">
                                        Ative para habilitar o destaque preventivo automático de <strong>IBS (Imposto sobre Bens e Serviços)</strong> e <strong>CBS (Contribuição sobre Bens e Serviços)</strong> nas Notas Fiscais Eletrônicas (NF-e/NFS-e), alinhando a sua empresa ao prazo final obrigatório de <strong>31 de julho de 2026</strong>.
                                    </p>
                                    {config.regime_tributario === '1' && (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center gap-1">
                                            ⚠️ Sua empresa está configurada no Simples Nacional. O destaque de IBS/CBS é recomendado preventivamente para simular a transição tributária, mas as regras definitivas de cobrança entram em vigor a partir de agosto de 2026 principalmente para o Regime Geral.
                                        </p>
                                    )}
                                    {config.reforma_tributaria_calculadora_ativa && (
                                        <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-white/50 dark:bg-slate-900/40 rounded-xl border border-emerald-500/10 backdrop-blur-sm animate-fadeIn">
                                            <div className="space-y-1">
                                                <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                                                    Alíquota de Teste CBS (%)
                                                </label>
                                                <div className="relative rounded-lg shadow-sm">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={config.reforma_tributaria_cbs_aliquota || '0.90'}
                                                        onChange={(e) => setConfig({ ...config, reforma_tributaria_cbs_aliquota: e.target.value })}
                                                        className="w-full rounded-lg border border-emerald-500/20 dark:border-emerald-500/30 bg-white/70 dark:bg-slate-800/80 py-1.5 pl-3 pr-16 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-emerald-950 dark:text-emerald-100"
                                                        placeholder="0.90"
                                                    />
                                                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[9px] font-extrabold text-emerald-600/70">
                                                        FED (0,9%)
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                                                    Alíquota de Teste IBS (%)
                                                </label>
                                                <div className="relative rounded-lg shadow-sm">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={config.reforma_tributaria_ibs_aliquota || '0.10'}
                                                        onChange={(e) => setConfig({ ...config, reforma_tributaria_ibs_aliquota: e.target.value })}
                                                        className="w-full rounded-lg border border-emerald-500/20 dark:border-emerald-500/30 bg-white/70 dark:bg-slate-800/80 py-1.5 pl-3 pr-24 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-emerald-950 dark:text-emerald-100"
                                                        placeholder="0.10"
                                                    />
                                                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[9px] font-extrabold text-emerald-600/70">
                                                        EST/MUN (0,1%)
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-span-2 text-[10px] text-emerald-700/90 dark:text-emerald-300/90 leading-normal bg-emerald-500/5 dark:bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/10 mt-1">
                                                💡 <strong>Período de Teste e Transição:</strong> O governo instituiu a alíquota simbólica total de <strong>1%</strong> (<strong>0,9% CBS</strong> e <strong>0,1% IBS</strong>) em caráter meramente informativo para homologação técnica dos ERPs, sem gerar cobranças adicionais imediatas.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tributação Federal / Simples Nacional */}
                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="text-blue-500" size={18} />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Tributação Federal (Simples Nacional)</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Situação Tributária do PIS/COFINS
                                </label>
                                <select
                                    value={config.pis_cofins_situacao_tributaria}
                                    onChange={(e) => setConfig({ ...config, pis_cofins_situacao_tributaria: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="00">00 - Nenhum / Não Informado</option>
                                    <option value="01">01 - Operação Tributável com Alíquota Básica</option>
                                    <option value="02">02 - Operação Tributável com Alíquota Diferenciada</option>
                                    <option value="03">03 - Operação Tributável com Alíquota por Unidade de Medida de Produto</option>
                                    <option value="04">04 - Operação Tributável monofásica - Revenda a Alíquota Zero</option>
                                    <option value="05">05 - Operação Tributável por Substituição Tributária</option>
                                    <option value="06">06 - Operação Tributável a Alíquota Zero</option>
                                    <option value="07">07 - Operação Isenta da Contribuição</option>
                                    <option value="08">08 - Operação sem Incidência da Contribuição</option>
                                    <option value="09">09 - Operação com Suspensão da Contribuição</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Tipo de retenção do PIS/COFINS/CSLL
                                </label>
                                <select
                                    value={config.pis_cofins_csll_retencao_tipo}
                                    onChange={(e) => setConfig({ ...config, pis_cofins_csll_retencao_tipo: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="1">PIS/COFINS/CSLL Não Retidos</option>
                                    <option value="2">PIS/COFINS/CSLL Retidos</option>
                                    <option value="3">PIS/COFINS Retidos, CSLL Não Retido</option>
                                    <option value="4">PIS Retido, COFINS/CSLL Não Retido</option>
                                    <option value="5">COFINS Retido, PIS/CSLL Não Retido</option>
                                </select>
                            </div>

                            <Input
                                label="Alíquota no Simples Nacional (%)"
                                value={config.simples_nacional_aliquota}
                                onChange={(e) => setConfig({ ...config, simples_nacional_aliquota: e.target.value })}
                                placeholder="6.00"
                                type="number"
                                step="0.01"
                            />

                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Regime de Apuração do Simples Nacional
                                </label>
                                <select
                                    value={config.simples_nacional_regime_apuracao}
                                    onChange={(e) => setConfig({ ...config, simples_nacional_regime_apuracao: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="1">1 - Tributos federais e municipal pelo Simples Nacional</option>
                                    <option value="2">2 - Tributos federais pelo Simples Nacional e ISSQN pela NFS-e</option>
                                    <option value="3">3 - Tributos federais e municipal pela NFS-e</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="text-blue-600" size={20} />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configurações Fiscais Padrão (NFS-e)</h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                            Estes valores serão usados como padrão ao criar novas Notas Fiscais Avulsas, mas podem ser alterados em cada nota se necessário.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="CNAE Principal"
                                value={config.default_cnae || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, default_cnae: e.target.value })}
                                placeholder="Ex: 7490104"
                                autoComplete="off"
                            />
                            <Input
                                label="Cód. Tributação Padrão"
                                value={config.default_taxation_code || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, default_taxation_code: e.target.value })}
                                placeholder={config.nfse_nacional ? "Ex: 010101001 (9 dígitos)" : "Ex: 14.10"}
                                autoComplete="off"
                                helpText={config.nfse_nacional ? "Para o padrão Nacional, use o código de 9 dígitos sem pontos." : "Código municipal ou LC 116."}
                                error={config.nfse_nacional && config.default_taxation_code && config.default_taxation_code.replace(/\D/g, '').length !== 9 ? "O código nacional deve ter exatamente 9 dígitos numéricos." : undefined}
                            />
                            {config.regime_tributario === '3' && (
                                <Input
                                    label="Alíquota ISS Padrão (%)"
                                    type="number"
                                    value={config.default_iss_aliquota || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, default_iss_aliquota: e.target.value })}
                                    placeholder="Ex: 3"
                                    autoComplete="off"
                                />
                            )}
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Exigibilidade ISS Padrão
                                </label>
                                <select
                                    value={config.default_iss_exigibilidade || '1'}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig({ ...config, default_iss_exigibilidade: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoComplete="off"
                                >
                                    <option value="1">Exigível</option>
                                    <option value="2">Não Incidência</option>
                                    <option value="3">Isenção</option>
                                    <option value="4">Exportação</option>
                                    <option value="5">Imunidade</option>
                                    <option value="6">Exigibilidade Suspensa por Decisão Judicial</option>
                                    <option value="7">Exigibilidade Suspensa por Processo Administrativo</option>
                                </select>
                            </div>
                            {/* Só mostra se não for Simples Nacional para evitar confusão com a nova seção de Tributação Federal */}
                            {config.regime_tributario === '3' && (
                                <div className="space-y-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Regime Especial de Tributação
                                    </label>
                                    <select
                                        value={config.default_regime_especial || '0'}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig({ ...config, default_regime_especial: e.target.value })}
                                        className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        autoComplete="off"
                                    >
                                        <option value="0">Nenhum</option>
                                        <option value="1">Microempresa Municipal</option>
                                        <option value="2">Estimativa</option>
                                        <option value="3">Sociedade de Profissionais</option>
                                        <option value="4">Cooperativa</option>
                                        <option value="5">Microempreendedor Individual (MEI)</option>
                                        <option value="6">Microempresa ou EPP (Simples Nacional)</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {config.regime_tributario === '3' && (
                            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Retenções Federais Padrão (%) (Regime Normal)</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Input
                                        label="PIS (%)"
                                        type="number"
                                        step="0.01"
                                        value={config.default_pis_aliquota || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, default_pis_aliquota: e.target.value })}
                                        placeholder="0.65"
                                    />
                                    <Input
                                        label="COFINS (%)"
                                        type="number"
                                        step="0.01"
                                        value={config.default_cofins_aliquota || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, default_cofins_aliquota: e.target.value })}
                                        placeholder="3.00"
                                    />
                                    <Input
                                        label="CSLL (%)"
                                        type="number"
                                        step="0.01"
                                        value={config.default_csll_aliquota || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, default_csll_aliquota: e.target.value })}
                                        placeholder="1.00"
                                    />
                                    <Input
                                        label="IRRF (%)"
                                        type="number"
                                        step="0.01"
                                        value={config.default_irrf_aliquota || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, default_irrf_aliquota: e.target.value })}
                                        placeholder="1.50"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <Send className="text-purple-600" size={20} />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Automação de Envio</h3>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                            Configure como seus clientes receberão as notas fiscais após a autorização e o padrão de emissão.
                        </p>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl">
                                            <Globe size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white">Padrão NFS-e Nacional</p>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">Ative se sua cidade já utiliza o novo padrão nacional da Receita Federal.</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={config.nfse_nacional || false}
                                            onChange={(e) => setConfig({ ...config, nfse_nacional: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>
                                
                                <div className="mt-2 pt-3 border-t border-gray-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    {config.endereco?.codigoCidade ? (
                                        <>
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Município Configurado</span>
                                                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                                    {config.endereco?.cidade || 'Cidade não informada'} - {config.endereco?.uf || 'UF'} (IBGE: {config.endereco?.codigoCidade})
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleCheckCityNationalStatus}
                                                disabled={checkingCityNationalStatus}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all disabled:opacity-50 h-9 shrink-0"
                                            >
                                                {checkingCityNationalStatus ? (
                                                    <RefreshCw size={14} className="animate-spin text-indigo-500" />
                                                ) : (
                                                    <Search size={14} className="text-indigo-500" />
                                                )}
                                                Consultar Nota Nacional
                                            </button>
                                        </>
                                    ) : (
                                        <div className="w-full py-1">
                                            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                                                <AlertCircle size={14} />
                                                Defina o Endereço e o Código IBGE acima para consultar se a sua cidade suporta a NFS-e Nacional.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Ferramenta de Homologação de Cidades TecnoSpeed */}
                            <div className="p-6 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 dark:from-slate-900/50 dark:via-slate-900/40 dark:to-purple-955/5 rounded-2xl border border-gray-200/85 dark:border-slate-800 shadow-sm space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
                                            <Search size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">Ferramenta de Cobertura e Homologação</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Verifique a homologação e requisitos fiscais de qualquer cidade do Brasil na TecnoSpeed.</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 border border-indigo-150/40 shrink-0">
                                        2.226 Cidades & 152 Padrões
                                    </span>
                                </div>

                                {/* Dropdown de Seleção de Tipo de Busca (como no mockup do usuário) */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Pesquisa</label>
                                        <select
                                            value={searchMode}
                                            onChange={(e) => {
                                                setSearchMode(e.target.value as 'name' | 'ibge' | 'uf');
                                                setTecnoSpeedCityInfo(null);
                                                setCityNotHomologatedMessage(null);
                                            }}
                                            className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                                        >
                                            <option value="name">Buscar cidades por nome</option>
                                            <option value="ibge">Buscar cidades por código IBGE</option>
                                            <option value="uf">Buscar cidades por UF</option>
                                        </select>
                                    </div>

                                    {/* Inputs contextuais baseados na escolha do usuário */}
                                    {searchMode === 'name' && (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado (UF)</label>
                                                <select
                                                    value={searchUf}
                                                    onChange={(e) => setSearchUf(e.target.value)}
                                                    className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                                                >
                                                    {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                                        <option key={uf} value={uf}>{uf}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5 relative" ref={cityDropdownRef}>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cidade</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder={loadingCitiesList ? 'Carregando cidades...' : 'Digite para buscar a cidade...'}
                                                        value={searchCityQuery}
                                                        onChange={(e) => {
                                                            setSearchCityQuery(e.target.value);
                                                            setIsCityDropdownOpen(true);
                                                            const exactMatch = citiesList.find(c => c.nome.toLowerCase() === e.target.value.toLowerCase());
                                                            if (exactMatch) {
                                                                setSelectedSearchCity(exactMatch);
                                                            } else {
                                                                setSelectedSearchCity(null);
                                                            }
                                                            setTecnoSpeedCityInfo(null);
                                                        }}
                                                        onFocus={() => setIsCityDropdownOpen(true)}
                                                        disabled={loadingCitiesList}
                                                        className="w-full h-11 pl-4 pr-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-all shadow-sm"
                                                        autoComplete="off"
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                                        {searchCityQuery && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSearchCityQuery('');
                                                                    setSelectedSearchCity(null);
                                                                    setTecnoSpeedCityInfo(null);
                                                                }}
                                                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsCityDropdownOpen(!isCityDropdownOpen)}
                                                            disabled={loadingCitiesList}
                                                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                        >
                                                            <ChevronRight size={16} className={`transform transition-transform duration-200 ${isCityDropdownOpen ? '-rotate-90' : 'rotate-90'}`} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {isCityDropdownOpen && filteredCities.length > 0 && (
                                                    <div className="absolute left-0 right-0 top-[102%] z-50 max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl scrollbar-thin animate-in fade-in slide-in-from-top-1 duration-150">
                                                        {filteredCities.map((c) => (
                                                            <button
                                                                key={c.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedSearchCity(c);
                                                                    setSearchCityQuery(c.nome);
                                                                    setTecnoSpeedCityInfo(null);
                                                                    setIsCityDropdownOpen(false);
                                                                }}
                                                                className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between ${selectedSearchCity?.id === c.id ? 'bg-indigo-50/50 dark:bg-slate-700/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
                                                            >
                                                                <span>{c.nome}</span>
                                                                {selectedSearchCity?.id === c.id && <Check size={12} className="text-indigo-600 dark:text-indigo-400" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {searchMode === 'ibge' && (
                                        <div className="flex flex-col gap-1.5 md:col-span-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Código IBGE (7 dígitos)</label>
                                            <input
                                                type="text"
                                                maxLength={7}
                                                placeholder="Digite o código IBGE de 7 dígitos... Ex: 2400208"
                                                value={searchIbgeQuery}
                                                onChange={(e) => setSearchIbgeQuery(e.target.value.replace(/\D/g, ''))}
                                                className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 tracking-wider shadow-sm text-gray-700 dark:text-gray-300"
                                            />
                                        </div>
                                    )}

                                    {searchMode === 'uf' && (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado (UF)</label>
                                                <select
                                                    value={searchUf}
                                                    onChange={(e) => setSearchUf(e.target.value)}
                                                    className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                                                >
                                                    {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                                        <option key={uf} value={uf}>{uf}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex items-center h-11">
                                                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 font-medium">
                                                    Total no Estado: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{citiesList.length} cidades</strong>
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Botão de Busca Contextual */}
                                <div className="flex justify-end pt-1">
                                    {searchMode === 'name' && (
                                        <Button
                                            type="button"
                                            onClick={handleSearchCityTecnoSpeed}
                                            disabled={!selectedSearchCity || searchingCityTecnoSpeed}
                                            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                                        >
                                            {searchingCityTecnoSpeed ? (
                                                <RefreshCw size={14} className="animate-spin text-white" />
                                            ) : (
                                                <Search size={14} className="text-white" />
                                            )}
                                            Buscar Cidade
                                        </Button>
                                    )}

                                    {searchMode === 'ibge' && (
                                        <Button
                                            type="button"
                                            onClick={() => handleSearchCityByIbge(searchIbgeQuery)}
                                            disabled={searchIbgeQuery.length !== 7 || searchingCityTecnoSpeed}
                                            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                                        >
                                            {searchingCityTecnoSpeed ? (
                                                <RefreshCw size={14} className="animate-spin text-white" />
                                            ) : (
                                                <Search size={14} className="text-white" />
                                            )}
                                            Buscar por IBGE
                                        </Button>
                                    )}

                                    {searchMode === 'uf' && (
                                        <Button
                                            type="button"
                                            onClick={() => setIsStateModalOpen(true)}
                                            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-500/10 transition-all active:scale-95"
                                        >
                                            <Globe size={16} />
                                            Visualizar Cobertura Estadual ({searchUf})
                                        </Button>
                                    )}
                                </div>

                                                                {/* Card de Resultado para Nome ou IBGE */}
                                {tecnoSpeedCityInfo && (searchMode === 'name' || searchMode === 'ibge') && (
                                    <div className="mt-4 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-md animate-in fade-in slide-in-from-top-3 duration-300">
                                        {cityNotHomologatedMessage && (
                                            <div className="p-4 bg-rose-50 dark:bg-rose-955/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-start gap-3 text-rose-800 dark:text-rose-455 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <AlertCircle className="shrink-0 text-rose-500 mt-0.5" size={18} />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider">Atenção: Município Não Homologado</p>
                                                    <p className="text-[11px] font-semibold opacity-90 mt-1 leading-relaxed">{cityNotHomologatedMessage}</p>
                                                </div>
                                            </div>
                                        )}
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                            {/* Detalhes do Município */}
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex justify-between items-start w-full gap-4">
                                                        {/* Cidade */}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-wider select-none">
                                                                Cidade <Info size={10} className="text-gray-455 dark:text-slate-500 shrink-0" />
                                                            </span>
                                                            <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5 truncate">
                                                                {tecnoSpeedCityInfo.nome || selectedSearchCity?.nome || ('Código ' + (tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge))}
                                                            </span>
                                                        </div>
                                                        {/* UF */}
                                                        <div className="flex flex-col items-end shrink-0">
                                                            <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider select-none">
                                                                UF
                                                            </span>
                                                            <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                                                                {tecnoSpeedCityInfo.uf || searchUf}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Botão de definir como cidade ativa */}
                                                    {!cityNotHomologatedMessage && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const activeIbge = String(tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge || selectedSearchCity?.id);
                                                                const activeName = tecnoSpeedCityInfo.nome || selectedSearchCity?.nome;
                                                                const activeUf = tecnoSpeedCityInfo.uf || searchUf;
                                                                
                                                                setConfig(prev => ({
                                                                    ...prev,
                                                                    endereco: {
                                                                        ...prev.endereco,
                                                                        codigoCidade: activeIbge,
                                                                        cidade: activeName,
                                                                        uf: activeUf
                                                                    }
                                                                }));
                                                                
                                                                setResultModal({
                                                                    isOpen: true,
                                                                    title: 'Cidade Selecionada!',
                                                                    message: `A cidade ${activeName} - ${activeUf} foi definida como ativa nas configurações fiscais do emitente. Lembre-se de salvar para persistir as alterações.`,
                                                                    type: 'success'
                                                                });
                                                            }}
                                                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-955/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 flex items-center gap-1 active:scale-95 transition-all shrink-0 ml-2"
                                                        >
                                                            <Check size={12} />
                                                            Definir como Cidade Ativa
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Três colunas técnicas */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Layout de integração</span>
                                                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                                                            {tecnoSpeedCityInfo.padrao?.toLowerCase() === 'nacional' ? 'NFS-e Nacional' : 'WebService'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Padrão</span>
                                                        {tecnoSpeedCityInfo.padrao ? (
                                                            <a 
                                                                href={`https://docs.plugnotas.com.br/docs/padrao-${tecnoSpeedCityInfo.padrao.toLowerCase()}`}
                                                                target="_blank" 
                                                                rel="noopener noreferrer" 
                                                                className="text-[10px] font-extrabold text-sky-500 hover:text-sky-655 dark:text-sky-400 dark:hover:text-sky-300 mt-0.5 flex items-center gap-0.5 transition-colors truncate"
                                                            >
                                                                <ExternalLink size={9} className="shrink-0" />
                                                                {tecnoSpeedCityInfo.padrao}
                                                            </a>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 mt-0.5">Não informado</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Código IBGE</span>
                                                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 font-mono truncate">
                                                            {tecnoSpeedCityInfo.codigoIbge || tecnoSpeedCityInfo.ibge || selectedSearchCity?.id}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Dados obrigatórios */}
                                                <div className="flex flex-col pt-1">
                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-widest select-none">
                                                        Dados obrigatórios das notas tomadas <Info size={9} className="text-gray-405 dark:text-slate-500 shrink-0" />
                                                    </span>
                                                    <span className={`text-[10px] font-extrabold mt-0.5 leading-relaxed truncate ${
                                                        formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas) === "Consulta não disponível"
                                                            ? 'text-gray-450 dark:text-slate-500 font-medium'
                                                            : 'text-gray-800 dark:text-slate-350'
                                                    }`}>
                                                        {formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Checklist de Recursos & Requisitos */}
                                            <div className="p-5 bg-gray-50/50 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4">
                                                <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-normal select-none">Requisitos e Recursos Homologados</h5>
                                                
                                                <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-4">
                                                    {/* Item 1: Notas tomadas */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {!!tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas && formatDadosObrigatorios(tecnoSpeedCityInfo.dadosObrigatoriosNotasTomadas) !== "Consulta não disponível" ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Notas tomadas <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>

                                                    {/* Item 2: Login */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {tecnoSpeedCityInfo.login ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Login <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>

                                                    {/* Item 3: Senha */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {tecnoSpeedCityInfo.senha ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Senha <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>

                                                    {/* Item 4: Múltiplos serviços */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {tecnoSpeedCityInfo.multiservicos ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Múltiplos serviços <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>

                                                    {/* Item 5: Certificado */}
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {tecnoSpeedCityInfo.certificado ? (
                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                <Check size={9} strokeWidth={4} />
                                                            </span>
                                                        ) : (
                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                <X size={9} strokeWidth={4} />
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                            Certificado <Info size={9} className="text-gray-400 shrink-0" />
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                                        <Mail size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Enviar E-mail Automaticamente</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">O PlugNotas enviará o PDF e XML diretamente para o e-mail do cliente.</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={config.send_email_automatically || false}
                                        onChange={(e) => setConfig({ ...config, send_email_automatically: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                                        <MessageCircle size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">Enviar WhatsApp Automaticamente</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-400">O sistema enviará o link da nota pelo WhatsApp (Evolution API).</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={config.send_whatsapp_automatically || false}
                                        onChange={(e) => setConfig({ ...config, send_whatsapp_automatically: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="text-green-600" size={20} />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Credenciais TecnoSpeed</h3>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg mb-6 flex items-start gap-3 border border-amber-100 dark:border-amber-900/30">
                            <AlertCircle className="text-amber-600 shrink-0" size={20} />
                            <p className="text-xs text-amber-800 dark:text-amber-400">
                                Sua API Key pode ser encontrada no painel do PlugNotas. Recomendamos testar primeiro em ambiente de <strong>Homologação</strong> para evitar o consumo de notas reais.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <Input
                                    label="TecnoSpeed API Key"
                                    type={showApiKey ? 'text' : 'password'}
                                    value={config.tecnospeed_api_key || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, tecnospeed_api_key: e.target.value })}
                                    placeholder="Insira sua chave"
                                    preserveCase={true}
                                    autoComplete="one-time-code"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-3 top-[32px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {showApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Ambiente de Emissão
                                </label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="ambiente"
                                            value="homologacao"
                                            checked={config.ambiente === 'homologacao'}
                                            onChange={(e) => setConfig({ ...config, ambiente: e.target.value, use_test_data: true })}
                                            className="text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm">Homologação (Teste)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="ambiente"
                                            value="producao"
                                            checked={config.ambiente === 'producao'}
                                            onChange={(e) => setConfig({ ...config, ambiente: e.target.value, use_test_data: false })}
                                            className="text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm">Produção (Real)</span>
                                    </label>
                                </div>

                                {config.ambiente === 'homologacao' && (
                                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!!config.use_test_data}
                                                onChange={(e) => setConfig({ ...config, use_test_data: e.target.checked })}
                                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-blue-900 dark:text-blue-100">
                                                    Ativar Dados de Teste TecnoSpeed (Maringá)
                                                </span>
                                                <span className="text-xs text-blue-700 dark:text-blue-300">
                                                    Ao marcar, o sistema usará o CNPJ (08.184.315/0001-04) e endereço de teste da TecnoSpeed automaticamente. 
                                                    Ideal para quando o IBGE da sua cidade não é aceito no Sandbox.
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 border-t border-gray-100 dark:border-slate-800 pt-4">
                            <label className="flex items-center gap-2 cursor-pointer mb-4 w-fit">
                                <input
                                    type="checkbox"
                                    checked={!!(config.ambiente === 'homologacao' ? config.endpoint_homologacao : config.endpoint_producao)}
                                    onChange={(e) => {
                                        if (!e.target.checked) {
                                            setConfig({
                                                ...config,
                                                ...(config.ambiente === 'homologacao' ? { endpoint_homologacao: '' } : { endpoint_producao: '' })
                                            });
                                        } else {
                                            setConfig({
                                                ...config,
                                                ...(config.ambiente === 'homologacao' ? { endpoint_homologacao: 'https://api.sandbox.plugnotas.com.br' } : { endpoint_producao: 'https://api.plugnotas.com.br' })
                                            });
                                        }
                                    }}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Usar Endpoint Personalizado</span>
                            </label>

                            {(config.ambiente === 'homologacao' && config.endpoint_homologacao !== '') || 
                             (config.ambiente === 'producao' && config.endpoint_producao !== '') || 
                             (config.endpoint_homologacao || config.endpoint_producao) ? (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    {config.ambiente === 'homologacao' ? (
                                        <Input
                                            label="Endpoint Personalizado (Homologação)"
                                            value={config.endpoint_homologacao?.toLowerCase() || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endpoint_homologacao: e.target.value.toLowerCase() })}
                                            placeholder="Ex: https://api.sandbox.plugnotas.com.br"
                                            preserveCase={true}
                                            autoComplete="off"
                                        />
                                    ) : (
                                        <Input
                                            label="Endpoint Personalizado (Produção)"
                                            value={config.endpoint_producao?.toLowerCase() || ''}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endpoint_producao: e.target.value.toLowerCase() })}
                                            placeholder="Ex: https://api.plugnotas.com.br"
                                            preserveCase={true}
                                            autoComplete="off"
                                        />
                                    )}
                                    <p className="text-xs text-gray-500 mt-2">
                                        Deixe desmarcado para usar a URL padrão da TecnoSpeed.
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>


                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center">
                        <a
                            href="https://plugnotas.com.br"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
                        >
                            Acessar Painel TecnoSpeed <ExternalLink size={14} />
                        </a>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleCheckIssuerStatus}
                                isLoading={checkingStatus}
                                className="text-gray-600 hover:bg-gray-100"
                            >
                                <RefreshCw size={18} className={`mr-2 ${checkingStatus ? 'animate-spin' : ''}`} />
                                Verificar Status
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleSyncIssuer}
                                isLoading={syncing}
                                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                                <RefreshCw size={18} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
                                Sincronizar Emitente
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDeactivateIssuer}
                                isLoading={deactivating}
                                className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                            >
                                <Trash2 size={18} className="mr-2" />
                                Inativar Emitente
                            </Button>
                            <Button 
                                type="submit" 
                                isLoading={saving} 
                                className={`transition-all duration-300 ${isDirty ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                            >
                                <Save size={18} className="mr-2" />
                                Salvar Configurações {isDirty && ' (Pendente)'}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        )}

        {/* Sub-tab 2: NFe.io */}
        {activeSubTab === 'nfeio' && (
            <div className="space-y-6 bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-start gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                    <Building2 className="text-indigo-600 mt-1" size={24} />
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configurações NFe.io</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Insira as credenciais da sua conta NFe.io para ativação e integração da emissão de notas fiscais.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative">
                        <Input
                            label="Chave de API (API Key)"
                            type={showNfeioApiKey ? 'text' : 'password'}
                            value={nfeioConfig.apiKey}
                            onChange={(e) => setNfeioConfig({ ...nfeioConfig, apiKey: e.target.value })}
                            placeholder="Ex: api_key_..."
                            preserveCase={true}
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={() => setShowNfeioApiKey(!showNfeioApiKey)}
                            className="absolute right-3 top-[32px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            {showNfeioApiKey ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    <Input
                        label="ID da Empresa (Company ID)"
                        value={nfeioConfig.companyId}
                        onChange={(e) => setNfeioConfig({ ...nfeioConfig, companyId: e.target.value })}
                        placeholder="Ex: 5f9b..."
                        preserveCase={true}
                        error={
                            nfeioConfig.companyId && nfeioConfig.companyId.trim().length === 24
                                ? 'Aviso: Esse ID tem 24 caracteres (padrão de ID de Conta). O ID da Empresa na NFe.io geralmente tem 32 caracteres (ex: fec1854455894d6b8efe72a2ef6cd43a).'
                                : undefined
                        }
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Ambiente
                        </label>
                        <select
                            value={nfeioConfig.ambiente}
                            onChange={(e) => setNfeioConfig({ ...nfeioConfig, ambiente: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                            <option value="homologacao">Homologação (Testes)</option>
                            <option value="producao">Produção (Real)</option>
                        </select>
                    </div>

                    <div className="flex items-center mt-6">
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={nfeioConfig.simplesNacional}
                                onChange={(e) => setNfeioConfig({ ...nfeioConfig, simplesNacional: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Optante pelo Simples Nacional</span>
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Input
                        label="CNAE Padrão"
                        value={nfeioConfig.cnae}
                        onChange={(e) => setNfeioConfig({ ...nfeioConfig, cnae: e.target.value })}
                        placeholder="Ex: 6201501"
                    />
                    <Input
                        label="Código de Serviço Municipal"
                        value={nfeioConfig.cityServiceCode}
                        onChange={(e) => setNfeioConfig({ ...nfeioConfig, cityServiceCode: e.target.value })}
                        placeholder="Ex: 1.01 ou 101"
                    />
                    <Input
                        label="Inscrição Municipal"
                        value={nfeioConfig.inscricaoMunicipal}
                        onChange={(e) => setNfeioConfig({ ...nfeioConfig, inscricaoMunicipal: e.target.value })}
                        placeholder="Ex: 123456"
                    />
                    <Input
                        label="Alíquota ISS (%)"
                        value={nfeioConfig.aliquotaIss}
                        onChange={(e) => setNfeioConfig({ ...nfeioConfig, aliquotaIss: e.target.value })}
                        placeholder="Ex: 2.0"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                                <Mail size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Enviar E-mail Automaticamente</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">A NFe.io enviará o PDF e link da nota diretamente para o e-mail do cliente.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={nfeioConfig.send_email_automatically || false}
                                onChange={(e) => setNfeioConfig({ ...nfeioConfig, send_email_automatically: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                                <MessageCircle size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Enviar WhatsApp Automaticamente</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">O sistema enviará o link da nota pelo WhatsApp (Evolution API).</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={nfeioConfig.send_whatsapp_automatically || false}
                                onChange={(e) => setNfeioConfig({ ...nfeioConfig, send_whatsapp_automatically: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>
                </div>

                {/* Reforma Tributária (IBS/CBS) Section */}
                <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                    <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10 dark:to-transparent rounded-2xl border border-emerald-500/20 dark:border-emerald-500/30 shadow-md backdrop-blur-md">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                                <Scale size={24} />
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div>
                                        <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            Reforma Tributária 2026
                                        </span>
                                        <h4 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                                            Destaque Automático de IBS e CBS
                                        </h4>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={!!nfeioConfig.reforma_tributaria_calculadora_ativa}
                                            onChange={(e) => setNfeioConfig({ ...nfeioConfig, reforma_tributaria_calculadora_ativa: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-2">
                                    Ative para habilitar o destaque preventivo automático de <strong>IBS (Imposto sobre Bens e Serviços)</strong> e <strong>CBS (Contribuição sobre Bens e Serviços)</strong> nas Notas Fiscais Eletrônicas (NF-e/NFS-e), alinhando a sua empresa ao prazo final obrigatório de <strong>31 de julho de 2026</strong>.
                                </p>
                                {nfeioConfig.simplesNacional && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center gap-1">
                                        ⚠️ Sua empresa está configurada no Simples Nacional. O destaque de IBS/CBS é recomendado preventivamente para simular a transição tributária, mas as regras definitivas de cobrança entram em vigor a partir de agosto de 2026 principalmente para o Regime Geral.
                                    </p>
                                )}
                                {nfeioConfig.reforma_tributaria_calculadora_ativa && (
                                    <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-white/50 dark:bg-slate-900/40 rounded-xl border border-emerald-500/10 backdrop-blur-sm animate-fadeIn">
                                        <div className="space-y-1">
                                            <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                                                Alíquota de Teste CBS (%)
                                            </label>
                                            <div className="relative rounded-lg shadow-sm">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={nfeioConfig.reforma_tributaria_cbs_aliquota || '0.90'}
                                                    onChange={(e) => setNfeioConfig({ ...nfeioConfig, reforma_tributaria_cbs_aliquota: e.target.value })}
                                                    className="w-full rounded-lg border border-emerald-500/20 dark:border-emerald-500/30 bg-white/70 dark:bg-slate-800/80 py-1.5 pl-3 pr-16 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-emerald-950 dark:text-emerald-100"
                                                    placeholder="0.90"
                                                />
                                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[9px] font-extrabold text-emerald-600/70">
                                                    FED (0,9%)
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                                                Alíquota de Teste IBS (%)
                                            </label>
                                            <div className="relative rounded-lg shadow-sm">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={nfeioConfig.reforma_tributaria_ibs_aliquota || '0.10'}
                                                    onChange={(e) => setNfeioConfig({ ...nfeioConfig, reforma_tributaria_ibs_aliquota: e.target.value })}
                                                    className="w-full rounded-lg border border-emerald-500/20 dark:border-emerald-500/30 bg-white/70 dark:bg-slate-800/80 py-1.5 pl-3 pr-24 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-emerald-950 dark:text-emerald-100"
                                                    placeholder="0.10"
                                                />
                                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[9px] font-extrabold text-emerald-600/70">
                                                    EST/MUN (0,1%)
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-[10px] text-emerald-700/90 dark:text-emerald-300/90 leading-normal bg-emerald-500/5 dark:bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/10 mt-1">
                                            💡 <strong>Período de Teste e Transição:</strong> O governo instituiu a alíquota simbólica total de <strong>1%</strong> (<strong>0,9% CBS</strong> e <strong>0,1% IBS</strong>) em caráter meramente informativo para homologação técnica dos ERPs, sem gerar cobranças adicionais imediatas.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-200 dark:border-slate-700">
                    <a
                        href="https://nfe.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-sm flex items-center gap-1.5 font-medium active:scale-95 transition-all"
                    >
                        Acessar Painel NFe.io <ExternalLink size={14} />
                    </a>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleCheckNfeioIssuerStatus}
                            isLoading={checkingNfeioStatus}
                            className="text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50"
                        >
                            <RefreshCw size={18} className={`mr-2 ${checkingNfeioStatus ? 'animate-spin' : ''}`} />
                            Verificar Status da Empresa
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleSyncNfeioIssuer}
                            isLoading={syncingNfeio}
                            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/55 dark:text-indigo-400 dark:hover:bg-indigo-950/20"
                        >
                            <RefreshCw size={18} className={`mr-2 ${syncingNfeio ? 'animate-spin' : ''}`} />
                            Sincronizar Emitente
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleDeactivateIssuer}
                            isLoading={deactivating}
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 dark:border-red-900/55 dark:text-red-400 dark:hover:bg-red-950/20"
                        >
                            <Trash2 size={18} className="mr-2" />
                            Inativar Emitente
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveNfeio}
                            isLoading={savingNfeio}
                            variant="primary"
                        >
                            <Save size={18} className="mr-2" />
                            Salvar Configurações NFe.io
                        </Button>
                    </div>
                </div>

                {/* Ferramenta de Homologação de Cidades NFe.io */}
                <div className="mt-8 p-6 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 dark:from-slate-900/50 dark:via-slate-900/40 dark:to-purple-955/5 rounded-2xl border border-gray-200/85 dark:border-slate-800 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
                                <Search size={18} />
                            </div>
                            <div>
                                <h4 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">Ferramenta de Cobertura (NFe.io)</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Verifique a cobertura e informações de suporte de qualquer cidade do Brasil na NFe.io.</p>
                            </div>
                        </div>
                    </div>

                    {/* Dropdown de Seleção de Tipo de Busca */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Pesquisa</label>
                            <select
                                value={searchModeNfeio}
                                onChange={(e) => {
                                    setSearchModeNfeio(e.target.value as 'name' | 'ibge' | 'uf');
                                    setNfeioCityInfo(null);
                                    setNfeioCityNotCoveredMessage(null);
                                }}
                                className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                            >
                                <option value="name">Buscar cidades por nome</option>
                                <option value="ibge">Buscar cidades por código IBGE</option>
                                <option value="uf">Buscar cidades por UF</option>
                            </select>
                        </div>

                        {/* Inputs contextuais baseados na escolha do usuário */}
                        {searchModeNfeio === 'name' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado (UF)</label>
                                    <select
                                        value={searchUfNfeio}
                                        onChange={(e) => setSearchUfNfeio(e.target.value)}
                                        className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                                    >
                                        {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                            <option key={uf} value={uf}>{uf}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5 relative" ref={cityDropdownRefNfeio}>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cidade</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={loadingCitiesListNfeio ? 'Carregando cidades...' : 'Digite para buscar a cidade...'}
                                            value={searchCityQueryNfeio}
                                            onChange={(e) => {
                                                setSearchCityQueryNfeio(e.target.value);
                                                setIsCityDropdownOpenNfeio(true);
                                                const exactMatch = citiesListNfeio.find(c => c.nome.toLowerCase() === e.target.value.toLowerCase());
                                                if (exactMatch) {
                                                    setSelectedSearchCityNfeio(exactMatch);
                                                } else {
                                                    setSelectedSearchCityNfeio(null);
                                                }
                                                setNfeioCityInfo(null);
                                            }}
                                            onFocus={() => setIsCityDropdownOpenNfeio(true)}
                                            disabled={loadingCitiesListNfeio}
                                            className="w-full h-11 pl-4 pr-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-all shadow-sm"
                                            autoComplete="off"
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                            {searchCityQueryNfeio && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchCityQueryNfeio('');
                                                        setSelectedSearchCityNfeio(null);
                                                        setNfeioCityInfo(null);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsCityDropdownOpenNfeio(!isCityDropdownOpenNfeio)}
                                                disabled={loadingCitiesListNfeio}
                                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <ChevronRight size={16} className={`transform transition-transform duration-200 ${isCityDropdownOpenNfeio ? '-rotate-90' : 'rotate-90'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {isCityDropdownOpenNfeio && filteredCitiesNfeio.length > 0 && (
                                        <div className="absolute left-0 right-0 top-[102%] z-50 max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl scrollbar-thin animate-in fade-in slide-in-from-top-1 duration-150">
                                            {filteredCitiesNfeio.map((c) => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedSearchCityNfeio(c);
                                                        setSearchCityQueryNfeio(c.nome);
                                                        setNfeioCityInfo(null);
                                                        setIsCityDropdownOpenNfeio(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between ${selectedSearchCityNfeio?.id === c.id ? 'bg-indigo-50/50 dark:bg-slate-700/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}
                                                >
                                                    <span>{c.nome}</span>
                                                    {selectedSearchCityNfeio?.id === c.id && <Check size={12} className="text-indigo-600 dark:text-indigo-400" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {searchModeNfeio === 'ibge' && (
                            <div className="flex flex-col gap-1.5 md:col-span-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Código IBGE (7 dígitos)</label>
                                <input
                                    type="text"
                                    maxLength={7}
                                    placeholder="Digite o código IBGE de 7 dígitos... Ex: 2400208"
                                    value={searchIbgeQueryNfeio}
                                    onChange={(e) => setSearchIbgeQueryNfeio(e.target.value.replace(/\D/g, ''))}
                                    className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 tracking-wider shadow-sm text-gray-700 dark:text-gray-300"
                                />
                            </div>
                        )}

                        {searchModeNfeio === 'uf' && (
                            <>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado (UF)</label>
                                    <select
                                        value={searchUfNfeio}
                                        onChange={(e) => setSearchUfNfeio(e.target.value)}
                                        className="h-11 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 shadow-sm cursor-pointer"
                                    >
                                        {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                                            <option key={uf} value={uf}>{uf}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center h-11">
                                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 font-medium">
                                        Total no Estado: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{citiesListNfeio.length} cidades</strong>
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Botão de Busca Contextual */}
                    <div className="flex justify-end pt-1">
                        {searchModeNfeio === 'name' && (
                            <Button
                                type="button"
                                onClick={handleSearchCityNfeio}
                                disabled={!selectedSearchCityNfeio || searchingCityNfeio}
                                className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                            >
                                {searchingCityNfeio ? (
                                    <RefreshCw size={14} className="animate-spin text-white" />
                                ) : (
                                    <Search size={14} className="text-white" />
                                )}
                                Buscar Cidade
                            </Button>
                        )}

                        {searchModeNfeio === 'ibge' && (
                            <Button
                                type="button"
                                onClick={() => handleSearchCityByIbgeNfeio(searchIbgeQueryNfeio)}
                                disabled={searchIbgeQueryNfeio.length !== 7 || searchingCityNfeio}
                                className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                            >
                                {searchingCityNfeio ? (
                                    <RefreshCw size={14} className="animate-spin text-white" />
                                ) : (
                                    <Search size={14} className="text-white" />
                                )}
                                Buscar por IBGE
                            </Button>
                        )}

                        {searchModeNfeio === 'uf' && (
                            <Button
                                type="button"
                                onClick={() => {
                                    setSearchUf(searchUfNfeio);
                                    setIsStateModalOpen(true);
                                }}
                                className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-500/10 transition-all active:scale-95"
                            >
                                <Globe size={16} />
                                Visualizar Cobertura Estadual ({searchUfNfeio})
                            </Button>
                        )}
                    </div>

                    {/* Card de Resultado para Nome ou IBGE */}
                    {nfeioCityInfo && (searchModeNfeio === 'name' || searchModeNfeio === 'ibge') && (
                        <div className="mt-4 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-150 dark:border-slate-800 shadow-md animate-in fade-in slide-in-from-top-3 duration-300">
                            {nfeioCityNotCoveredMessage && (
                                <div className="p-4 bg-rose-50 dark:bg-rose-955/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-start gap-3 text-rose-800 dark:text-rose-455 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <AlertCircle className="shrink-0 text-rose-500 mt-0.5" size={18} />
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider">Atenção: Município Sem Cobertura</p>
                                        <p className="text-[11px] font-semibold opacity-90 mt-1 leading-relaxed">{nfeioCityNotCoveredMessage}</p>
                                    </div>
                                </div>
                            )}
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                {/* Detalhes do Município */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex justify-between items-start w-full gap-4">
                                            {/* Cidade */}
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-wider select-none">
                                                    Cidade <Info size={10} className="text-gray-455 dark:text-slate-500 shrink-0" />
                                                </span>
                                                <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5 truncate">
                                                    {nfeioCityInfo.name || nfeioCityInfo.nome || selectedSearchCityNfeio?.nome || ('Código ' + (nfeioCityInfo.id || nfeioCityInfo.codigoIbge))}
                                                </span>
                                            </div>
                                            {/* UF */}
                                            <div className="flex flex-col items-end shrink-0">
                                                <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider select-none">
                                                    UF
                                                </span>
                                                <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5">
                                                    {nfeioCityInfo.state || nfeioCityInfo.uf || searchUfNfeio}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Duas colunas técnicas */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Código IBGE</span>
                                            <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 font-mono truncate font-semibold">
                                                {nfeioCityInfo.id || nfeioCityInfo.codigoIbge || selectedSearchCityNfeio?.id}
                                            </span>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Provedor</span>
                                            <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                                                {nfeioCityInfo.providerId || 'Não Informado'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Informações Extras de Integração */}
                                    <div className="flex flex-col pt-1">
                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-widest select-none">
                                            Layout de integração
                                        </span>
                                        <span className="text-[10px] font-semibold mt-0.5 leading-relaxed text-gray-800 dark:text-slate-350">
                                            API NFe.io (WebService integrado)
                                        </span>
                                    </div>
                                </div>

                                {/* Dados de Suporte da Prefeitura */}
                                <div className="p-5 bg-gray-50/50 dark:bg-slate-900/60 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4">
                                    <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-normal select-none">Canais de Contato & Suporte</h5>
                                    <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="text-gray-450 dark:text-slate-500 font-bold select-none w-16 uppercase text-[9px] tracking-wider">E-mail:</span>
                                            <span className="text-gray-800 dark:text-slate-300 font-semibold truncate">
                                                {nfeioCityInfo.email || 'Não informado'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="text-gray-450 dark:text-slate-500 font-bold select-none w-16 uppercase text-[9px] tracking-wider">Telefone:</span>
                                            <span className="text-gray-800 dark:text-slate-300 font-semibold">
                                                {nfeioCityInfo.phoneNumber || 'Não informado'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="text-gray-450 dark:text-slate-500 font-bold select-none w-16 uppercase text-[9px] tracking-wider">Site:</span>
                                            {nfeioCityInfo.webSite ? (
                                                <a
                                                    href={nfeioCityInfo.webSite}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sky-500 hover:text-sky-650 dark:text-sky-400 dark:hover:text-sky-300 font-extrabold flex items-center gap-1 transition-colors truncate"
                                                >
                                                    <ExternalLink size={11} className="shrink-0" />
                                                    Portal Prefeitura
                                                </a>
                                            ) : (
                                                <span className="text-gray-800 dark:text-slate-300 font-semibold">Não informado</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Sub-tab 3: Outros */}
        {activeSubTab === 'other' && (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                <div className="space-y-6 bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-start gap-4 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-100 dark:border-orange-900/30">
                        <Globe className="text-orange-600 mt-1" size={24} />
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Outras Tecnologias Fiscais (Integração Customizada)</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Configure e envie payloads JSON diretamente para o seu endpoint externo (Webhook/Relay).
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-gray-100 dark:border-slate-800 pt-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Send className="text-orange-600" size={20} />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Integração Externa (JSON Relay)</h3>
                        </div>
                        
                        <label className="flex items-center gap-2 cursor-pointer mb-4 w-fit">
                            <input
                                type="checkbox"
                                checked={!!config.use_external_webhook}
                                onChange={(e) => setConfig({ ...config, use_external_webhook: e.target.checked })}
                                className="rounded text-orange-600 focus:ring-orange-500"
                            />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enviar JSON para Endpoint Externo (Webhook)</span>
                        </label>

                        {config.use_external_webhook && (
                            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/20 animate-in fade-in duration-200">
                                <Input
                                    label="URL do Webhook Externo"
                                    value={config.external_webhook_url || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, external_webhook_url: e.target.value })}
                                    placeholder="Ex: https://seu-sistema.com/webhook-fiscal"
                                    preserveCase={true}
                                    autoComplete="off"
                                    helpText="ATENÇÃO: Ao ativar esta opção, o sistema enviará o JSON APENAS para este endpoint e IGNORARÁ a TecnoSpeed. Útil para integrar com emissores próprios."
                                />
                                <div className="mt-4 relative">
                                    <Input
                                        label="Token de Autorização (Opcional)"
                                        type={showWebhookToken ? 'text' : 'password'}
                                        value={config.external_webhook_token || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, external_webhook_token: e.target.value })}
                                        placeholder="Ex: seu-token-secreto"
                                        preserveCase={true}
                                        autoComplete="off"
                                        helpText="Se preenchido, será enviado no header 'Authorization: Bearer [token]'."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowWebhookToken(!showWebhookToken)}
                                        className="absolute right-3 top-[32px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        {showWebhookToken ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Reforma Tributária (IBS/CBS) Section */}
                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                        <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-500/20 dark:via-teal-500/10 dark:to-transparent rounded-2xl border border-emerald-500/20 dark:border-emerald-500/30 shadow-md backdrop-blur-md">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                                    <Scale size={24} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div>
                                            <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                Reforma Tributária 2026
                                            </span>
                                            <h4 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                                                Destaque Automático de IBS e CBS
                                            </h4>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={!!config.reforma_tributaria_calculadora_ativa}
                                                onChange={(e) => setConfig({ ...config, reforma_tributaria_calculadora_ativa: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                                        </label>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mt-2">
                                        Ative para habilitar o destaque preventivo automático de <strong>IBS (Imposto sobre Bens e Serviços)</strong> e <strong>CBS (Contribuição sobre Bens e Serviços)</strong> nas Notas Fiscais Eletrônicas (NF-e/NFS-e), alinhando a sua empresa ao prazo final obrigatório de <strong>31 de julho de 2026</strong>.
                                    </p>
                                    {config.regime_tributario === '1' && (
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center gap-1">
                                            ⚠️ Sua empresa está configurada no Simples Nacional. O destaque de IBS/CBS é recomendado preventivamente para simular a transição tributária, mas as regras definitivas de cobrança entram em vigor a partir de agosto de 2026 principalmente para o Regime Geral.
                                        </p>
                                    )}
                                    {config.reforma_tributaria_calculadora_ativa && (
                                        <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-white/50 dark:bg-slate-900/40 rounded-xl border border-emerald-500/10 backdrop-blur-sm animate-fadeIn">
                                            <div className="space-y-1">
                                                <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                                                    Alíquota de Teste CBS (%)
                                                </label>
                                                <div className="relative rounded-lg shadow-sm">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={config.reforma_tributaria_cbs_aliquota || '0.90'}
                                                        onChange={(e) => setConfig({ ...config, reforma_tributaria_cbs_aliquota: e.target.value })}
                                                        className="w-full rounded-lg border border-emerald-500/20 dark:border-emerald-500/30 bg-white/70 dark:bg-slate-800/80 py-1.5 pl-3 pr-16 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-emerald-950 dark:text-emerald-100"
                                                        placeholder="0.90"
                                                    />
                                                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[9px] font-extrabold text-emerald-600/70">
                                                        FED (0,9%)
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                                                    Alíquota de Teste IBS (%)
                                                </label>
                                                <div className="relative rounded-lg shadow-sm">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={config.reforma_tributaria_ibs_aliquota || '0.10'}
                                                        onChange={(e) => setConfig({ ...config, reforma_tributaria_ibs_aliquota: e.target.value })}
                                                        className="w-full rounded-lg border border-emerald-500/20 dark:border-emerald-500/30 bg-white/70 dark:bg-slate-800/80 py-1.5 pl-3 pr-24 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-emerald-950 dark:text-emerald-100"
                                                        placeholder="0.10"
                                                    />
                                                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[9px] font-extrabold text-emerald-600/70">
                                                        EST/MUN (0,1%)
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="col-span-2 text-[10px] text-emerald-700/90 dark:text-emerald-300/90 leading-normal bg-emerald-500/5 dark:bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/10 mt-1">
                                                💡 <strong>Período de Teste e Transição:</strong> O governo instituiu a alíquota simbólica total de <strong>1%</strong> (<strong>0,9% CBS</strong> e <strong>0,1% IBS</strong>) em caráter meramente informativo para homologação técnica dos ERPs, sem gerar cobranças adicionais imediatas.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-6 border-t border-gray-200 dark:border-slate-700">
                        <Button 
                            type="submit" 
                            isLoading={saving} 
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            <Save size={18} className="mr-2" />
                            Salvar Configurações Outros
                        </Button>
                    </div>
                </div>
            </form>
        )}

        {/* Bloco Compartilhado: Laboratório de Testes (JSON Manual) */}
        {((activeSubTab === 'tecnospeed' && config.ambiente === 'homologacao') || 
          (activeSubTab === 'nfeio' && nfeioConfig.ambiente === 'homologacao') ||
          activeSubTab === 'other') && (
            <div className="mt-6 bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <RefreshCw className={`text-purple-600 ${testingJson ? 'animate-spin' : ''}`} size={20} />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        Laboratório de Testes (JSON Manual)
                        <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-black rounded border border-purple-200 dark:border-purple-800">
                            v1.2.0
                        </span>
                    </h3>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-xl border border-purple-100 dark:border-purple-900/20">
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-4">
                        Use esta área para testar payloads JSON diretamente. Útil para validar campos específicos exigidos pela {activeSubTab === 'nfeio' ? 'NFe.io' : 'TecnoSpeed'}.
                    </p>
                    
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-medium text-gray-500 uppercase">Conteúdo do JSON</label>
                            <label className="text-xs text-purple-600 font-medium cursor-pointer hover:underline flex items-center gap-1">
                                <ExternalLink size={12} />
                                Carregar Arquivo .json
                                <input type="file" accept=".json" onChange={handleFileJson} className="hidden" />
                            </label>
                        </div>
                        
                        <textarea
                            value={testJson}
                            onChange={(e) => setTestJson(e.target.value)}
                            className="w-full h-48 p-3 text-xs font-mono bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder={activeSubTab === 'nfeio' 
                                ? '[\n  {\n    "tomador": {\n      "cpfCnpj": "00000000000191",\n      "razaoSocial": "Empresa de Teste LTDA",\n      "endereco": {\n        "logradouro": "Rua Teste",\n        "numero": "1001",\n        "bairro": "Centro",\n        "cep": "01001000",\n        "uf": "SP",\n        "cidade": "Sao Paulo"\n      }\n    },\n    "servico": [\n      {\n        "codigo": "1.01",\n        "discriminacao": "Prestação de serviço via NFe.io",\n        "valorUnitario": 100.00\n      }\n    ]\n  }\n]'
                                : '{ "prestador": { ... }, "tomador": { ... }, "servico": { ... } }'
                            }
                        />
                        
                        <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                                {lastTestResult && (
                                    <Tooltip content="Visualizar Último Resultado (PDF/XML)">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="border-purple-200 text-purple-600 hover:bg-purple-50 h-10 w-10 p-0 flex items-center justify-center rounded-xl transition-all active:scale-90"
                                            onClick={() => setResultModal({
                                                isOpen: true,
                                                title: 'Visualizar Nota de Teste',
                                                message: 'Visualizando o último resultado emitido pelo laboratório.',
                                                type: 'success',
                                                data: lastTestResult
                                            })}
                                        >
                                            <Eye size={18} />
                                        </Button>
                                    </Tooltip>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-purple-600 hover:bg-purple-100 h-10 font-bold"
                                    onClick={handleGenerateExample}
                                    disabled={testingJson}
                                >
                                    Gerar Exemplo
                                </Button>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-10 px-4 rounded-xl font-medium"
                                    onClick={() => {
                                        setTestJson('');
                                        setLastTestResult(null);
                                    }}
                                    disabled={!testJson || testingJson}
                                >
                                    Limpar
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 h-10 rounded-xl shadow-lg shadow-purple-500/20"
                                    onClick={handleTestJson}
                                    isLoading={testingJson}
                                    disabled={!testJson || testingJson}
                                >
                                    <Send size={16} className="mr-2" />
                                    Emitir Via JSON Manual
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Bloco Compartilhado: Certificado Digital (A1) */}
        {(activeSubTab === 'tecnospeed' || activeSubTab === 'nfeio') && (
            <div className="mt-6 bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="text-blue-600" size={20} />
                        <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">Certificado Digital (A1)</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {currentCertInfo.id 
                                    ? 'Certificado configurado e pronto para uso.'
                                    : 'O envio do certificado digital A1 (.pfx ou .p12) é obrigatório para a emissão de notas em produção.'
                                }
                            </p>
                        </div>
                    </div>
                    {currentCertInfo.id && (
                        <Button
                            type="button"
                            onClick={handleDeleteCertificate}
                            isLoading={deletingCert}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border border-rose-100 text-xs px-3 py-1.5 h-auto rounded-xl flex items-center gap-1.5 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"
                        >
                            <Trash2 size={14} />
                            Excluir Certificado
                        </Button>
                    )}
                </div>

                {currentCertInfo.id && (
                    <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Status</p>
                                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {currentCertInfo.status === 'ativo' ? 'Ativo' : 'Pendente'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Vencimento</p>
                                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                                    {currentCertInfo.vencimento ? new Date(currentCertInfo.vencimento).toLocaleDateString('pt-BR') : 'Não informado'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Sujeito</p>
                                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 truncate" title={currentCertInfo.sujeito}>
                                    {currentCertInfo.sujeito || 'Certificado A1'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                    {activeSubTab === 'nfeio' ? 'ID NFe.io' : 'ID PlugNotas'}
                                </p>
                                <p className="text-sm font-mono text-emerald-700 dark:text-emerald-300">
                                    {currentCertInfo.id.substring(0, 8)}...
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!currentCertInfo.id && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-xl">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Sua senha é transmitida de forma segura e não fica armazenada em nossos servidores.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Arquivo do Certificado (.pfx, .p12)
                        </label>
                        <input
                            type="file"
                            accept=".pfx,.p12"
                            ref={fileInputRef}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                    </div>
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <Input
                                label="Senha do Certificado"
                                type="password"
                                value={certPassword}
                                onChange={(e: any) => setCertPassword(e.target.value)}
                                placeholder="Sua senha"
                                autoComplete="current-password"
                            />
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleUploadCertificate}
                            isLoading={uploadingCert}
                            className="border-blue-200 text-blue-700 hover:bg-blue-50 h-[42px]"
                        >
                            <Save size={18} className="mr-2" />
                            Subir Certificado
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </div>

            {/* Modal de Diagnóstico */}
            <DiagnosticModal
                isOpen={diagnostic.isOpen}
                onClose={() => setDiagnostic(prev => ({ ...prev, isOpen: false }))}
                title="Diagnóstico de Envio"
                description={activeSubTab === 'nfeio' ? "Status da integração com NFe.io" : "Status da integração com PlugNotas"}
                steps={diagnostic.steps}
                logs={diagnostic.logs}
                action={{
                    label: diagnostic.steps.some(s => s.status === 'error') ? 'Ver Detalhes do Erro' : 'Ver Resultado Final',
                    visible: !diagnostic.steps.some(s => s.status === 'loading' || s.status === 'pending'),
                    variant: diagnostic.steps.some(s => s.status === 'error') ? 'warning' : 'success',
                    onClick: async () => {
                        const hasError = diagnostic.steps.some(s => s.status === 'error');
                        await refreshEntity();
                        setDiagnostic(prev => ({ ...prev, isOpen: false }));
                        setResultModal({
                            isOpen: true,
                            title: hasError ? 'Processo com Avisos' : 'Sucesso!',
                            message: hasError 
                                ? 'O processo terminou, mas houve problemas em alguns passos. Verifique os logs.'
                                : 'O certificado foi enviado e o vínculo automático foi processado.',
                            type: hasError ? 'error' : 'success',
                            data: {
                                'ID Certificado': config.certificado_id || 'ID pendente',
                                'Vencimento': config.certificado_vencimento ? new Date(config.certificado_vencimento).toLocaleDateString('pt-BR') : 'N/A',
                                'Auto-Vínculo': hasError ? 'Falhou' : 'Concluído'
                            }
                        });
                    }
                }}
            />

            {/* Modal de Cobertura e Homologações por Estado (UF) */}
            {isStateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/80 dark:border-slate-800 shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        
                        {/* Header do Modal */}
                        <div className="p-6 border-b border-gray-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <span className="p-1.5 bg-indigo-100 dark:bg-indigo-955 text-indigo-650 dark:text-indigo-400 rounded-xl">
                                        <Globe size={18} />
                                    </span>
                                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">
                                        Diretório de Cobertura do Estado: <span className="text-indigo-600 dark:text-indigo-400 font-black">{searchUf}</span>
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30">
                                        {citiesList.length} Municípios
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Consulte e gerencie a homologação fiscal de todas as cidades do estado em lote ou individualmente.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    onClick={handleVerifyAllStateCities}
                                    disabled={verifyingAllStateCities || citiesList.length === 0}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-indigo-500/10 flex items-center gap-1.5"
                                >
                                    {verifyingAllStateCities ? (
                                        <RefreshCw size={14} className="animate-spin" />
                                    ) : (
                                        <Check size={14} />
                                    )}
                                    {verifyingAllStateCities 
                                        ? `Verificando (${verificationProgress.current}/${verificationProgress.total})`
                                        : 'Verificar Todos os Municípios'
                                    }
                                </Button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (verifyingAllStateCities) {
                                            if (confirm('Deseja interromper a verificação em lote?')) {
                                                setVerifyingAllStateCities(false);
                                            } else {
                                                return;
                                            }
                                        }
                                        setIsStateModalOpen(false);
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Barra de Progresso Encorpada para Verificação em Lote */}
                        {verifyingAllStateCities && (
                            <div className="bg-indigo-50/50 dark:bg-indigo-950/10 border-b border-indigo-100/30 dark:border-indigo-950/20 px-6 py-2.5 flex items-center justify-between gap-4 animate-in slide-in-from-top-1">
                                <div className="flex-1">
                                    <div className="flex justify-between text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                                        <span>Processando homologações em lote...</span>
                                        <span>{Math.round((verificationProgress.current / verificationProgress.total) * 100)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-indigo-600 h-full rounded-full transition-all duration-150"
                                            style={{ width: `${(verificationProgress.current / verificationProgress.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setVerifyingAllStateCities(false)}
                                    className="px-3 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-extrabold text-rose-600 hover:text-rose-700 active:scale-95 transition-all shadow-sm shrink-0"
                                >
                                    Parar lote
                                </button>
                            </div>
                        )}

                        {/* Filtros Internos do Modal */}
                        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Filtrar municípios por nome ou código IBGE..."
                                    value={stateModalFilterQuery}
                                    onChange={(e) => setStateModalFilterQuery(e.target.value)}
                                    className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-955/20 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 transition-all shadow-inner"
                                />
                                {stateModalFilterQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setStateModalFilterQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-auto">
                                Exibindo {filteredStateCities.length} de {citiesList.length} cidades
                            </span>
                        </div>

                        {/* Corpo Scrollable com Grid de Cidades */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-slate-950/10 scrollbar-thin">
                            {filteredStateCities.length === 0 ? (
                                <div className="py-20 flex flex-col justify-center items-center text-center">
                                    <Search size={32} className="text-gray-300 dark:text-slate-700 mb-3" />
                                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Nenhuma cidade encontrada</p>
                                    <p className="text-xs text-gray-400 mt-1">Tente ajustar sua busca por nome ou código IBGE.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredStateCities.map((city) => {
                                        const status = stateCitiesStatus[city.id];
                                        const isVerified = !!status && !status.loading && (!!status.data || !!status.error);
                                        const notHomologated = !!status && !!status.isNotHomologated;
                                        const cityInfo = status?.data;

                                        return (
                                                                                        <div 
                                                key={city.id}
                                                className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 flex flex-col justify-between group ${
                                                    status?.loading 
                                                        ? 'border-indigo-300 dark:border-indigo-900 ring-2 ring-indigo-500/10 bg-indigo-50/5 dark:bg-indigo-955/5 animate-pulse' 
                                                        : isVerified && notHomologated
                                                            ? 'border-rose-200 dark:border-rose-955/40 hover:border-rose-300 dark:hover:border-rose-955/60 shadow-sm shadow-rose-500/5'
                                                            : isVerified
                                                                ? 'border-emerald-250 dark:border-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-950/60 shadow-sm shadow-emerald-500/5'
                                                                : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-md'
                                                }`}
                                            >
                                                {/* Topo do Card */}
                                                <div>
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="flex justify-between items-start w-full gap-4">
                                                            {/* Cidade */}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-wider select-none">
                                                                    Cidade <Info size={10} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                                </span>
                                                                <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5 truncate" title={city.nome}>
                                                                    {city.nome}
                                                                </span>
                                                            </div>
                                                            {/* UF */}
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <span className="text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider select-none">
                                                                    UF
                                                                </span>
                                                                <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5">
                                                                    {searchUf}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Status Badge */}
                                                        {status?.loading ? (
                                                            <span className="inline-flex items-center gap-1 text-[8px] font-extrabold text-indigo-655 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-955 px-1.5 py-0.5 rounded-md border border-indigo-100/30 shrink-0">
                                                                <RefreshCw size={8} className="animate-spin" />
                                                                Consultando
                                                            </span>
                                                        ) : isVerified && notHomologated ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-rose-600 dark:text-rose-455 bg-rose-50 dark:bg-rose-955/30 px-1.5 py-0.5 rounded-md border border-rose-100/30 shrink-0">
                                                                <X size={8} />
                                                                Indisponível
                                                            </span>
                                                        ) : isVerified ? (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-emerald-600 dark:text-emerald-450 bg-emerald-50 dark:bg-emerald-955/30 px-1.5 py-0.5 rounded-md border border-emerald-100/30 shrink-0">
                                                                <Check size={8} />
                                                                Homologado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-850 px-1.5 py-0.5 rounded-md border border-gray-150/40 shrink-0">
                                                                Não verificado
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Conteúdo Técnico */}
                                                    {isVerified ? (
                                                        activeSubTab === 'nfeio' ? (
                                                            <div className="mt-4 space-y-3.5 animate-in fade-in duration-200">
                                                                {/* Duas colunas técnicas: Provedor e Código IBGE */}
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Código IBGE</span>
                                                                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 font-mono truncate">
                                                                            {city.id}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Provedor</span>
                                                                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                                                                            {cityInfo?.providerId || 'Não Informado'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                                                {/* Canais de Contato / Suporte */}
                                                                <div className="space-y-2.5">
                                                                    <div className="flex items-center gap-2 text-[10px]">
                                                                        <span className="text-gray-400 dark:text-slate-500 font-bold select-none w-14 uppercase text-[8px] tracking-wider">E-mail:</span>
                                                                        <span className="text-gray-800 dark:text-slate-300 font-semibold truncate" title={cityInfo?.email}>
                                                                            {cityInfo?.email || 'Não informado'}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-2 text-[10px]">
                                                                        <span className="text-gray-400 dark:text-slate-500 font-bold select-none w-14 uppercase text-[8px] tracking-wider">Telefone:</span>
                                                                        <span className="text-gray-800 dark:text-slate-300 font-semibold truncate">
                                                                            {cityInfo?.phoneNumber || 'Não informado'}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-2 text-[10px]">
                                                                        <span className="text-gray-400 dark:text-slate-500 font-bold select-none w-14 uppercase text-[8px] tracking-wider">Site:</span>
                                                                        {cityInfo?.webSite ? (
                                                                            <a
                                                                                href={cityInfo.webSite}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 font-extrabold flex items-center gap-0.5 transition-colors truncate"
                                                                            >
                                                                                <ExternalLink size={9} className="shrink-0" />
                                                                                Portal Prefeitura
                                                                            </a>
                                                                        ) : (
                                                                            <span className="text-gray-800 dark:text-slate-300 font-semibold truncate">Não informado</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-4 space-y-3.5 animate-in fade-in duration-200">
                                                                {/* Três colunas técnicas: Layout, Padrão, Código IBGE */}
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Layout de integração</span>
                                                                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                                                                            {cityInfo?.padrao?.toLowerCase() === 'nacional' ? 'NFS-e Nacional' : 'WebService'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Padrão</span>
                                                                        {cityInfo?.padrao ? (
                                                                            <a 
                                                                                href={`https://docs.plugnotas.com.br/docs/padrao-${cityInfo.padrao.toLowerCase()}`}
                                                                                target="_blank" 
                                                                                rel="noopener noreferrer" 
                                                                                className="text-[10px] font-extrabold text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 mt-0.5 flex items-center gap-0.5 transition-colors truncate"
                                                                            >
                                                                                <ExternalLink size={9} className="shrink-0" />
                                                                                {cityInfo.padrao}
                                                                            </a>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 mt-0.5">Não informado</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-normal select-none">Código IBGE</span>
                                                                        <span className="text-[10px] font-extrabold text-gray-800 dark:text-slate-300 mt-0.5 font-mono truncate">
                                                                            {city.id}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Dados obrigatórios */}
                                                                <div className="flex flex-col pt-0.5">
                                                                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-bold flex items-center gap-0.5 uppercase tracking-widest select-none">
                                                                        Dados obrigatórios das notas tomadas <Info size={9} className="text-gray-400 dark:text-slate-500 shrink-0" />
                                                                    </span>
                                                                    <span className={`text-[10px] font-extrabold mt-0.5 leading-relaxed truncate ${
                                                                        formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas) === "Consulta não disponível"
                                                                            ? 'text-gray-400 dark:text-slate-500 font-medium'
                                                                            : 'text-gray-800 dark:text-slate-350'
                                                                    }`}>
                                                                        {formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas)}
                                                                    </span>
                                                                </div>

                                                                <hr className="border-gray-100 dark:border-slate-800/80 my-1" />

                                                                {/* Checklist de requisitos (Grid de 3 Colunas) */}
                                                                <div className="grid grid-cols-3 gap-x-2 gap-y-3 pt-1">
                                                                    {/* Item 1: Notas tomadas */}
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        {!!cityInfo?.dadosObrigatoriosNotasTomadas && formatDadosObrigatorios(cityInfo?.dadosObrigatoriosNotasTomadas) !== "Consulta não disponível" ? (
                                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                                <Check size={9} strokeWidth={4} />
                                                                            </span>
                                                                        ) : (
                                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                                <X size={9} strokeWidth={4} />
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                            Notas tomadas <Info size={9} className="text-gray-400 shrink-0" />
                                                                        </span>
                                                                    </div>

                                                                    {/* Item 2: Login */}
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        {cityInfo?.login ? (
                                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                                <Check size={9} strokeWidth={4} />
                                                                            </span>
                                                                        ) : (
                                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                                <X size={9} strokeWidth={4} />
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                            Login <Info size={9} className="text-gray-400 shrink-0" />
                                                                        </span>
                                                                    </div>

                                                                    {/* Item 3: Senha */}
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        {cityInfo?.senha ? (
                                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                                <Check size={9} strokeWidth={4} />
                                                                            </span>
                                                                        ) : (
                                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                                <X size={9} strokeWidth={4} />
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                            Senha <Info size={9} className="text-gray-400 shrink-0" />
                                                                        </span>
                                                                    </div>

                                                                    {/* Item 4: Múltiplos serviços */}
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        {cityInfo?.multiservicos ? (
                                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                                <Check size={9} strokeWidth={4} />
                                                                            </span>
                                                                        ) : (
                                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                                <X size={9} strokeWidth={4} />
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                            Múltiplos serviços <Info size={9} className="text-gray-400 shrink-0" />
                                                                        </span>
                                                                    </div>

                                                                    {/* Item 5: Certificado */}
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        {cityInfo?.certificado ? (
                                                                            <span className="p-0.5 bg-emerald-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-emerald-500/20">
                                                                                <Check size={9} strokeWidth={4} />
                                                                            </span>
                                                                        ) : (
                                                                            <span className="p-0.5 bg-rose-500 text-white rounded-full shrink-0 flex items-center justify-center w-4 h-4 shadow-sm shadow-rose-500/20">
                                                                                <X size={9} strokeWidth={4} />
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 flex items-center gap-0.5 truncate select-none">
                                                                            Certificado <Info size={9} className="text-gray-400 shrink-0" />
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="py-2.5 flex items-center justify-center text-center bg-gray-50 dark:bg-slate-855/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800 mt-3 flex-1 min-h-[140px]">
                                                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">
                                                                {activeSubTab === 'nfeio' ? 'Aguardando consulta de cobertura' : 'Aguardando consulta de requisitos'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Ações do Card */}
                                                <div className="mt-4 pt-3.5 border-t border-gray-150 dark:border-slate-805 flex items-center justify-between gap-2">
                                                    {/* Botão de Verificação Única / Re-verificação */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleVerifySingleCityInState(city.id, city.nome)}
                                                        disabled={status?.loading || verifyingAllStateCities}
                                                        className="text-[10px] font-bold text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <RefreshCw size={10} className={status?.loading ? 'animate-spin' : ''} />
                                                        {isVerified ? 'Atualizar Dados' : (activeSubTab === 'nfeio' ? 'Verificar Cobertura' : 'Verificar Requisitos')}
                                                    </button>

                                                    {/* Selecionar como ativa se homologado (Apenas para TecnoSpeed) */}
                                                    {isVerified && !notHomologated && activeSubTab !== 'nfeio' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setConfig(prev => ({
                                                                    ...prev,
                                                                    endereco: {
                                                                        ...prev.endereco,
                                                                        codigoCidade: String(city.id),
                                                                        cidade: city.nome,
                                                                        uf: searchUf
                                                                    }
                                                                }));
                                                                
                                                                setResultModal({
                                                                    isOpen: true,
                                                                    title: 'Cidade Selecionada!',
                                                                    message: `A cidade ${city.nome} - ${searchUf} foi definida como ativa nas configurações fiscais do emitente. Lembre-se de salvar para persistir as alterações.`,
                                                                    type: 'success'
                                                                });
                                                                setIsStateModalOpen(false);
                                                            }}
                                                            className="text-[10px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-0.5 active:scale-95 transition-all shadow-sm shadow-emerald-500/10"
                                                        >
                                                            <Check size={10} />
                                                            Selecionar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-4 border-t border-gray-150 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                            <span>Diretório de Cobertura Fiscal Antigravity</span>
                            <span>{activeSubTab === 'nfeio' ? 'NFe.io Prefeituras' : 'TecnoSpeed PlugNotas'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Resultado */}
            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
                data={resultModal.data}
                action={resultModal.action}
            />
        </>
    );
}
