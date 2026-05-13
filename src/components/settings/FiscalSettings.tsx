import { useState, useEffect, useRef } from 'react';
import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff, RefreshCw, Search, Mail, MessageCircle, Send, Globe } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';
import { ResultModal } from '../ui/ResultModal';
import { DiagnosticModal } from '../ui/DiagnosticModal';

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
    const [showWebhookToken, setShowWebhookToken] = useState(false);
    const [diagnostic, setDiagnostic] = useState<{
        isOpen: boolean;
        steps: { title: string; status: 'pending' | 'loading' | 'success' | 'error'; msg?: string }[];
        logs: string[];
    }>({
        isOpen: false,
        steps: [],
        logs: []
    });
    const [testJson, setTestJson] = useState('');
    const [testingJson, setTestingJson] = useState(false);

    // Persistência do diagnóstico em caso de troca de aba ou refresh
    useEffect(() => {
        if (!currentEntity.id) return;
        const saved = sessionStorage.getItem(`fiscal_diag_${currentEntity.id}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setDiagnostic(parsed);
            } catch (e) {
                sessionStorage.removeItem(`fiscal_diag_${currentEntity.id}`);
            }
        }
    }, [currentEntity.id]);

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
        use_external_webhook: false,
        external_webhook_url: '',
        external_webhook_token: ''
    });

    const currentCompany = companies.find(c => c.id === currentEntity.id);

    useEffect(() => {
        if (!currentCompany) return;

        setModuleEnabled(!!currentCompany.fiscal_module_enabled);
        setConfig((prev: any) => {
            const newConfig = { ...prev };
            const tc = currentCompany.tecnospeed_config || {};

            Object.assign(newConfig, tc);

            if (newConfig.tecnospeed_api_key) newConfig.tecnospeed_api_key = newConfig.tecnospeed_api_key.trim();
            if (newConfig.endpoint_homologacao) newConfig.endpoint_homologacao = newConfig.endpoint_homologacao.toLowerCase();
            if (newConfig.endpoint_producao) newConfig.endpoint_producao = newConfig.endpoint_producao.toLowerCase();

            if (!newConfig.cnpj && currentCompany.cnpj) newConfig.cnpj = currentCompany.cnpj;
            if (!newConfig.razao_social && currentCompany.legal_name) newConfig.razao_social = currentCompany.legal_name;
            if (!newConfig.nome_fantasia && currentCompany.trade_name) newConfig.nome_fantasia = currentCompany.trade_name;
            if (!newConfig.telefone && currentCompany.phone) newConfig.telefone = currentCompany.phone;

            if (!newConfig.endereco) {
                newConfig.endereco = {};
            }
            if (!newConfig.endereco.logradouro && currentCompany.street) newConfig.endereco.logradouro = currentCompany.street;
            if (!newConfig.endereco.numero && currentCompany.number) newConfig.endereco.numero = currentCompany.number;
            if (!newConfig.endereco.complemento && currentCompany.complement) newConfig.endereco.complemento = currentCompany.complement;
            if (!newConfig.endereco.bairro && currentCompany.neighborhood) newConfig.endereco.bairro = currentCompany.neighborhood;
            if (!newConfig.endereco.cidade && currentCompany.city) newConfig.endereco.cidade = currentCompany.city;
            if (!newConfig.endereco.cep && currentCompany.zip_code) newConfig.endereco.cep = currentCompany.zip_code;
            if (!newConfig.endereco.uf && currentCompany.state) newConfig.endereco.uf = currentCompany.state;

            return newConfig;
        });
    }, [currentCompany]);

    const [resultModal, setResultModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'info';
        data?: Record<string, any>;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

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
        setDiagnostic({
            isOpen: true,
            steps: [
                { title: 'Validando dados locais', status: 'loading' },
                { title: 'Autenticando sessão', status: 'pending' },
                { title: 'Enviando para Backend', status: 'pending' },
                { title: 'Processando na TecnoSpeed', status: 'pending' }
            ],
            logs: [`Iniciando upload de ${file.name}`]
        });

        try {
            if (!certPassword) throw new Error('Senha do certificado não informada');
            const isSandbox = config.ambiente === 'homologacao';
            const defaultBase = isSandbox ? 'https://api.sandbox.plugnotas.com.br' : 'https://api.plugnotas.com.br';
            const baseUrl = (isSandbox ? (config.endpoint_homologacao || defaultBase) : (config.endpoint_producao || defaultBase)).toLowerCase();
            const maskedKey = config.tecnospeed_api_key ? `${config.tecnospeed_api_key.substring(0, 4)}...${config.tecnospeed_api_key.substring(config.tecnospeed_api_key.length - 4)}` : 'NÃO INFORMADA';

            setDiagnostic(prev => ({
                ...prev,
                steps: prev.steps.map((s, i) => i === 0 ? { ...s, status: 'success' } : i === 1 ? { ...s, status: 'loading' } : s),
                logs: [
                    ...prev.logs, 
                    'Dados locais validados',
                    `Ambiente: ${config.ambiente?.toUpperCase()}`,
                    `URL Alvo: ${baseUrl}/certificado`,
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

            const response = await fiscalService.uploadCertificate(currentEntity.id, file, certPassword, token, config);
            
            setDiagnostic(prev => ({
                ...prev,
                steps: prev.steps.map((s, i) => i === 2 ? { ...s, status: 'success' } : i === 3 ? { ...s, status: 'loading' } : s),
                logs: [...prev.logs, 'Certificado recebido! Iniciando vínculo automático com a TecnoSpeed...']
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
                    certificado_id: response.id, // O backend retorna 'id' na raiz do objeto
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
                
                // Mesmo se o sync falhar, vamos atualizar o estado com o ID que subiu
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

    const handleTestJson = async () => {
        if (!testJson.trim()) return;
        setTestingJson(true);
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const payload = JSON.parse(testJson);
            const response = await fiscalService.emitirNFSe(currentEntity.id!, payload, token);
            setResultModal({
                isOpen: true,
                title: 'Resultado do Teste',
                message: 'Requisição enviada com sucesso ao servidor.',
                type: 'success',
                data: response
            });
        } catch (error: any) {
            console.error(error);
            setResultModal({
                isOpen: true,
                title: 'Erro no Teste',
                message: error.message || 'Erro ao processar o JSON ou na emissão.',
                type: 'error',
                data: error.response?.data
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
        const mock = {
            idIntegracao: `TEST_${Date.now()}`,
            prestador: {
                cpfCnpj: config.cnpj || "00.000.000/0001-00",
                inscricaoMunicipal: config.inscricao_municipal || "123456"
            },
            tomador: {
                cpfCnpj: "000.000.000-00",
                razaoSocial: "Cliente de Teste LTDA",
                email: "teste@exemplo.com",
                endereco: {
                    logradouro: "Rua de Teste",
                    numero: "100",
                    bairro: "Centro",
                    codigoCidade: "4115200",
                    descricaoCidade: "Maringá",
                    uf: "PR",
                    cep: "87000-000"
                }
            },
            servico: [
                {
                    codigo: "000101",
                    codigoTributacao: "101",
                    itemListaServico: "01.01",
                    descricao: "Serviço de Teste via Laboratório JSON",
                    valor: {
                        servico: 100.00
                    },
                    quantidade: 1
                }
            ]
        };
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

    const [checkingStatus, setCheckingStatus] = useState(false);

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
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                {/* Módulo Toggle */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
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

                <div className={`space-y-8 transition-opacity duration-200 ${moduleEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
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
                            <Input
                                label="Alíquota ISS Padrão (%)"
                                type="number"
                                value={config.default_iss_aliquota || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, default_iss_aliquota: e.target.value })}
                                placeholder="Ex: 3"
                                autoComplete="off"
                            />
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
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Retenções Federais Padrão (%)</h4>
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
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-800">
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
                                            onChange={(e) => setConfig({ ...config, ambiente: e.target.value })}
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
                                <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/20">
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

                        {config.ambiente === 'homologacao' && (
                            <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200 dark:border-slate-800">
                                <div className="flex items-center gap-2 mb-4">
                                    <RefreshCw className={`text-purple-600 ${testingJson ? 'animate-spin' : ''}`} size={20} />
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Laboratório de Testes (JSON Manual)</h3>
                                </div>
                                
                                <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-xl border border-purple-100 dark:border-purple-900/20">
                                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-4">
                                        Use esta área para testar payloads JSON diretamente. Útil para validar campos específicos exigidos pela TecnoSpeed.
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
                                            placeholder='{ "prestador": { ... }, "tomador": { ... }, "servico": { ... } }'
                                        />
                                        
                                        <div className="flex justify-end gap-3">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="text-purple-600 hover:bg-purple-100"
                                                onClick={handleGenerateExample}
                                                disabled={testingJson}
                                            >
                                                Gerar Exemplo
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setTestJson('')}
                                                disabled={!testJson || testingJson}
                                            >
                                                Limpar
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="bg-purple-600 hover:bg-purple-700 text-white"
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
                        )}
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="text-blue-600" size={20} />
                            <div className="flex-1">
                                <h4 className="font-medium text-gray-900 dark:text-white">Certificado Digital (A1)</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {config.certificado_id 
                                        ? 'Certificado configurado e pronto para uso.'
                                        : 'O envio do certificado digital A1 (.pfx ou .p12) é obrigatório para a emissão de notas em produção.'
                                    }
                                </p>
                            </div>
                        </div>

                        {config.certificado_id && (
                            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 rounded-xl">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Status</p>
                                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                            {config.certificado_status === 'ativo' ? 'Ativo' : 'Pendente'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Vencimento</p>
                                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                                            {config.certificado_vencimento ? new Date(config.certificado_vencimento).toLocaleDateString('pt-BR') : 'Não informado'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Sujeito</p>
                                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 truncate" title={config.certificado_sujeito}>
                                            {config.certificado_sujeito || 'Certificado A1'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">ID PlugNotas</p>
                                        <p className="text-sm font-mono text-emerald-700 dark:text-emerald-300">
                                            {config.certificado_id.substring(0, 8)}...
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!config.certificado_id && (
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
                            <Button type="submit" isLoading={saving} className="bg-indigo-600 hover:bg-indigo-700">
                                <Save size={18} className="mr-2" />
                                Salvar Configurações
                            </Button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Modal de Diagnóstico */}
            <DiagnosticModal
                isOpen={diagnostic.isOpen}
                onClose={() => setDiagnostic(prev => ({ ...prev, isOpen: false }))}
                title="Diagnóstico de Envio"
                description="Status da integração com PlugNotas"
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

            {/* Modal de Resultado */}
            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
                data={resultModal.data}
            />
        </>
    );
}
