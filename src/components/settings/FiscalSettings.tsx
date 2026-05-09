import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Building2, Save, ExternalLink, ShieldCheck, AlertCircle, Eye, EyeOff, RefreshCw, Terminal, CheckCircle, XCircle, Info, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useCompanies } from '../../hooks/useCompanies';
import { useEntity } from '../../context/EntityContext';
import { fiscalService } from '../../services/fiscalService';
import { supabase } from '../../lib/supabase';

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
    const [diagnostic, setDiagnostic] = useState<{
        isOpen: boolean;
        steps: { title: string; status: 'pending' | 'loading' | 'success' | 'error'; msg?: string }[];
        logs: string[];
    }>({
        isOpen: false,
        steps: [],
        logs: []
    });

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
        certificado_status: ''
    });

    const currentCompany = companies.find(c => c.id === currentEntity.id);

    useEffect(() => {
        if (!currentCompany) return;

        setModuleEnabled(!!currentCompany.fiscal_module_enabled);
        setConfig((prev: any) => {
            const newConfig = { ...prev };
            const tc = currentCompany.tecnospeed_config || {};

            Object.assign(newConfig, tc);

            if (newConfig.tecnospeed_api_key) newConfig.tecnospeed_api_key = newConfig.tecnospeed_api_key.toLowerCase();
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
                    certificado_id: response.data?.id
                }, token);
                
                setDiagnostic(prev => ({
                    ...prev,
                    steps: prev.steps.map((s, i) => i === 3 ? { ...s, status: 'success' } : s),
                    logs: [...prev.logs, 'Vínculo concluído com sucesso!', 'Resposta Sync: ' + JSON.stringify(syncResult)]
                }));
            } catch (syncErr: any) {
                console.warn('Falha no auto-sync, mas o certificado foi enviado:', syncErr);
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
                        />
                        <div className="space-y-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Regime Tributário
                            </label>
                            <select
                                value={config.regime_tributario}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setConfig({ ...config, regime_tributario: e.target.value })}
                                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                        />
                        <Input
                            label="Nome Fantasia"
                            value={config.nome_fantasia}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, nome_fantasia: e.target.value })}
                            placeholder="Nome da sua loja/empresa"
                        />
                        <Input
                            label="Inscrição Estadual"
                            value={config.inscricao_estadual}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, inscricao_estadual: e.target.value })}
                            placeholder="Isento ou Número"
                        />
                        <Input
                            label="Inscrição Municipal"
                            value={config.inscricao_municipal}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, inscricao_municipal: e.target.value })}
                            placeholder="Obrigatório para NFS-e"
                        />
                        <Input
                            label="E-mail"
                            type="email"
                            value={config.email}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, email: e.target.value })}
                            placeholder="contato@empresa.com"
                        />
                        <Input
                            label="Telefone"
                            value={config.telefone}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, telefone: e.target.value })}
                            placeholder="(00) 00000-0000"
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
                            />
                            <div className="md:col-span-2">
                                <Input
                                    label="Logradouro"
                                    value={config.endereco?.logradouro || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, logradouro: e.target.value } })}
                                    placeholder="Rua, Avenida, etc."
                                />
                            </div>
                            <Input
                                label="Número"
                                value={config.endereco?.numero || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, numero: e.target.value } })}
                                placeholder="123"
                            />
                            <div className="md:col-span-2">
                                <Input
                                    label="Complemento"
                                    value={config.endereco?.complemento || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, complemento: e.target.value } })}
                                    placeholder="Sala 1, Apto 2, etc."
                                />
                            </div>
                            <Input
                                label="Bairro"
                                value={config.endereco?.bairro || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, bairro: e.target.value } })}
                                placeholder="Centro"
                            />
                            <Input
                                label="Código Cidade (IBGE)"
                                value={config.endereco?.codigoCidade || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, codigoCidade: e.target.value } })}
                                placeholder="Ex: 3550308 (São Paulo)"
                            />
                            <Input
                                label="UF"
                                value={config.endereco?.uf || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, endereco: { ...config.endereco, uf: e.target.value } })}
                                placeholder="SP, RJ, MG"
                                maxLength={2}
                            />
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
                                    value={config.tecnospeed_api_key?.toLowerCase() || ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, tecnospeed_api_key: e.target.value.toLowerCase() })}
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
                                            onChange={(e) => setConfig({ ...config, ambiente: e.target.value })}
                                            className="text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-sm">Produção (Real)</span>
                                    </label>
                                </div>
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
            {diagnostic.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-2">
                                <Terminal size={20} className="text-indigo-600" />
                                <h3 className="font-bold text-slate-800 dark:text-white">Diagnóstico de Envio</h3>
                            </div>
                            <button 
                                onClick={() => setDiagnostic(prev => ({ ...prev, isOpen: false }))}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Passos */}
                            <div className="space-y-4">
                                {diagnostic.steps.map((step, idx) => (
                                    <div key={idx} className="flex items-start gap-3">
                                        <div className="mt-0.5">
                                            {step.status === 'loading' && <Loader2 size={18} className="text-blue-500 animate-spin" />}
                                            {step.status === 'success' && <CheckCircle size={18} className="text-green-500" />}
                                            {step.status === 'error' && <XCircle size={18} className="text-red-500" />}
                                            {step.status === 'pending' && <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-200 dark:border-slate-700" />}
                                        </div>
                                        <div className="flex-1">
                                            <p className={clsx(
                                                "text-sm font-medium",
                                                step.status === 'loading' ? "text-blue-600" :
                                                step.status === 'success' ? "text-green-600" :
                                                step.status === 'error' ? "text-red-600" : "text-slate-400"
                                            )}>
                                                {step.title}
                                            </p>
                                            {step.msg && <p className="text-xs text-red-400 mt-1">{step.msg}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Logs */}
                            <div className="bg-slate-950 rounded-lg p-4 font-mono text-[10px] text-slate-300 h-40 overflow-y-auto border border-slate-800">
                                <div className="flex items-center gap-2 mb-2 text-slate-500 border-b border-slate-800 pb-1">
                                    <Info size={12} />
                                    <span>LOGS TÉCNICOS</span>
                                </div>
                                {diagnostic.logs.map((log, idx) => (
                                    <div key={idx} className="mb-1 leading-relaxed">
                                        <span className="text-indigo-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                            <Button 
                                 onClick={() => {
                                     const text = diagnostic.logs.join('\n');
                                     navigator.clipboard.writeText(text);
                                     setResultModal({
                                         isOpen: true,
                                         title: 'Copiado',
                                         message: 'Logs de diagnóstico copiados para a área de transferência.',
                                         type: 'success'
                                     });
                                 }}
                                 variant="outline"
                                 className="text-xs h-8"
                             >
                                 Copiar Logs de Diagnóstico
                             </Button>
                             
                             {/* Botão de Ver Resultado Final - Só aparece quando termina */}
                             {!diagnostic.steps.some(s => s.status === 'loading' || s.status === 'pending') && (
                                 <Button 
                                     onClick={async () => {
                                         const hasError = diagnostic.steps.some(s => s.status === 'error');
                                         
                                         // Atualizamos os dados antes de fechar o diagnóstico
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
                                     }}
                                     className={clsx(
                                         "text-xs h-8 ml-2 shadow-sm",
                                         diagnostic.steps.some(s => s.status === 'error') ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                                     )}
                                 >
                                     {diagnostic.steps.some(s => s.status === 'error') ? 'Ver Detalhes do Erro' : 'Ver Resultado Final'}
                                 </Button>
                             )}
                         </div>
                     </div>
                 </div>
             )}

            {/* Modal de Resultado */}
            {resultModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                        <div className={clsx(
                            "p-8 flex flex-col items-center text-center",
                            resultModal.type === 'success' ? "bg-emerald-50/50 dark:bg-emerald-900/10" :
                            resultModal.type === 'error' ? "bg-red-50/50 dark:bg-red-900/10" : "bg-blue-50/50 dark:bg-blue-900/10"
                        )}>
                            <div className={clsx(
                                "w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm",
                                resultModal.type === 'success' ? "bg-emerald-100 text-emerald-600" :
                                resultModal.type === 'error' ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                            )}>
                                {resultModal.type === 'success' && <CheckCircle size={40} />}
                                {resultModal.type === 'error' && <XCircle size={40} />}
                                {resultModal.type === 'info' && <Info size={40} />}
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                                {resultModal.title}
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed">
                                {resultModal.message}
                            </p>
                        </div>

                        {resultModal.data && (
                            <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                                <div className="space-y-4">
                                    {Object.entries(resultModal.data).map(([key, value]) => (
                                        <div key={key} className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{key}</span>
                                            <span className="text-sm text-slate-900 dark:text-slate-200 font-mono bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700/50 break-all">
                                                {value || '---'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-center">
                            <Button 
                                onClick={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                                className={clsx(
                                    "w-full py-3 text-base font-bold transition-all shadow-md active:scale-95",
                                    resultModal.type === 'success' ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                                    resultModal.type === 'error' ? "bg-red-600 hover:bg-red-700 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                )}
                            >
                                OK, Entendido
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
