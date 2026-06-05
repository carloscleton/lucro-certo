import { useState } from 'react';
import { Landmark, Save, Trash2, Power, Info, Shield, Sparkles, Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { useBankingSettings } from '../../hooks/useBankingSettings';
import { useEntity } from '../../context/EntityContext';
import { useNotification } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';

interface BankField {
    key: string;
    label: string;
    placeholder: string;
    type?: string;
}

interface BankProvider {
    id: string;
    name: string;
    desc: string;
    fields: BankField[];
}

const BANK_PROVIDERS: BankProvider[] = [
    {
        id: 'itau_cnab',
        name: 'Banco Itaú (CNAB 240)',
        desc: 'Remessa de lote de boletos e Pix via arquivo CNAB 240.',
        fields: [
            { key: 'branch', label: 'Agência', placeholder: '0000' },
            { key: 'branch_digit', label: 'Dígito Agência', placeholder: '0' },
            { key: 'account', label: 'Conta Corrente', placeholder: '00000' },
            { key: 'account_digit', label: 'Dígito Conta', placeholder: '0' },
            { key: 'transmission_code', label: 'Código de Transmissão / Convênio', placeholder: 'Código fornecido pelo banco' },
            { key: 'cnpj', label: 'CNPJ da Conta', placeholder: '00.000.000/0000-00' }
        ]
    },
    {
        id: 'bb_cnab',
        name: 'Banco do Brasil (CNAB 240)',
        desc: 'Remessa de lote de boletos e Pix via arquivo CNAB 240.',
        fields: [
            { key: 'branch', label: 'Agência', placeholder: '0000' },
            { key: 'branch_digit', label: 'Dígito Agência', placeholder: '0' },
            { key: 'account', label: 'Conta Corrente', placeholder: '00000' },
            { key: 'account_digit', label: 'Dígito Conta', placeholder: '0' },
            { key: 'transmission_code', label: 'Número do Convênio', placeholder: 'Código de convênio BB (7 dígitos)' },
            { key: 'cnpj', label: 'CNPJ da Conta', placeholder: '00.000.000/0000-00' }
        ]
    },
    {
        id: 'bradesco_cnab',
        name: 'Banco Bradesco (CNAB 240)',
        desc: 'Remessa de lote de boletos e Pix via arquivo CNAB 240.',
        fields: [
            { key: 'branch', label: 'Agência', placeholder: '0000' },
            { key: 'branch_digit', label: 'Dígito Agência', placeholder: '0' },
            { key: 'account', label: 'Conta Corrente', placeholder: '00000' },
            { key: 'account_digit', label: 'Dígito Conta', placeholder: '0' },
            { key: 'transmission_code', label: 'Código de Transmissão / Convênio', placeholder: 'Código fornecido pelo banco' },
            { key: 'cnpj', label: 'CNPJ da Conta', placeholder: '00.000.000/0000-00' }
        ]
    },
    {
        id: 'santander_cnab',
        name: 'Banco Santander (CNAB 240)',
        desc: 'Remessa de lote de boletos e Pix via arquivo CNAB 240.',
        fields: [
            { key: 'branch', label: 'Agência', placeholder: '0000' },
            { key: 'branch_digit', label: 'Dígito Agência', placeholder: '0' },
            { key: 'account', label: 'Conta Corrente', placeholder: '00000' },
            { key: 'account_digit', label: 'Dígito Conta', placeholder: '0' },
            { key: 'transmission_code', label: 'Código de Transmissão / Convênio', placeholder: 'Código fornecido pelo banco' },
            { key: 'cnpj', label: 'CNPJ da Conta', placeholder: '00.000.000/0000-00' }
        ]
    },
    {
        id: 'caixa_cnab',
        name: 'Caixa Econômica Federal (CNAB 240)',
        desc: 'Remessa de lote de boletos e Pix via arquivo CNAB 240.',
        fields: [
            { key: 'branch', label: 'Agência', placeholder: '0000' },
            { key: 'branch_digit', label: 'Dígito Agência', placeholder: '0' },
            { key: 'account', label: 'Conta Corrente', placeholder: '00000' },
            { key: 'account_digit', label: 'Dígito Conta', placeholder: '0' },
            { key: 'transmission_code', label: 'Código do Convênio', placeholder: 'Código fornecido pela Caixa' },
            { key: 'cnpj', label: 'CNPJ da Conta', placeholder: '00.000.000/0000-00' }
        ]
    },
    {
        id: 'sicoob_cnab',
        name: 'Sicoob (CNAB 240)',
        desc: 'Remessa de lote de boletos e Pix via arquivo CNAB 240.',
        fields: [
            { key: 'branch', label: 'Agência', placeholder: '0000' },
            { key: 'branch_digit', label: 'Dígito Agência', placeholder: '0' },
            { key: 'account', label: 'Conta Corrente', placeholder: '00000' },
            { key: 'account_digit', label: 'Dígito Conta', placeholder: '0' },
            { key: 'transmission_code', label: 'Código do Convênio', placeholder: 'Código fornecido pelo Sicoob' },
            { key: 'cnpj', label: 'CNPJ da Conta', placeholder: '00.000.000/0000-00' }
        ]
    },
    {
        id: 'sicredi_cnab',
        name: 'Sicredi (CNAB 240)',
        desc: 'Remessa de lote de boletos e Pix via arquivo CNAB 240.',
        fields: [
            { key: 'branch', label: 'Agência', placeholder: '0000' },
            { key: 'branch_digit', label: 'Dígito Agência', placeholder: '0' },
            { key: 'account', label: 'Conta Corrente', placeholder: '00000' },
            { key: 'account_digit', label: 'Dígito Conta', placeholder: '0' },
            { key: 'transmission_code', label: 'Código do Posto / Convênio', placeholder: 'Código do posto e convênio' },
            { key: 'cnpj', label: 'CNPJ da Conta', placeholder: '00.000.000/0000-00' }
        ]
    },
    {
        id: 'inter_api',
        name: 'Banco Inter (API)',
        desc: 'Integração em tempo real para pagamentos e DDA.',
        fields: [
            { key: 'client_id', label: 'Client ID', placeholder: 'Chave obtida no console Inter' },
            { key: 'client_secret', label: 'Client Secret', placeholder: 'Segredo da API Inter', type: 'password' },
            { key: 'certificate_pem', label: 'Certificado Público (PEM)', placeholder: 'Cole o conteúdo do arquivo .key ou .crt público aqui', type: 'textarea' },
            { key: 'private_key_pem', label: 'Chave Privada (PEM)', placeholder: 'Cole o conteúdo do arquivo .key privado aqui', type: 'textarea_hidden' }
        ]
    },
    {
        id: 'stark_api',
        name: 'Stark Bank (API)',
        desc: 'Integração em tempo real de pagamentos corporativos e DDA.',
        fields: [
            { key: 'project_id', label: 'Project ID', placeholder: 'ID do Projeto no Stark Bank' },
            { key: 'environment', label: 'Ambiente (sandbox / production)', placeholder: 'sandbox' },
            { key: 'private_key', label: 'Chave Privada (ECDSA PEM)', placeholder: 'Cole a chave privada gerada do Stark Bank aqui', type: 'textarea_hidden' }
        ]
    },
    {
        id: 'asaas_api',
        name: 'Asaas (API)',
        desc: 'Integração via API da conta digital Asaas para liquidação e DDA.',
        fields: [
            { key: 'api_key', label: 'API Key (Token de Acesso)', placeholder: '$prod_... ou $sandbox_...', type: 'password' },
            { key: 'environment', label: 'Ambiente (sandbox / production)', placeholder: 'sandbox' }
        ]
    },
    {
        id: 'mercadopago_api',
        name: 'Mercado Pago (API)',
        desc: 'Integração via API Mercado Pago.',
        fields: [
            { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-...', type: 'password' },
            { key: 'public_key', label: 'Public Key', placeholder: 'APP_USR-...' }
        ]
    }
];

const CUSTOM_CNAB_FIELDS: BankField[] = [
    { key: 'branch', label: 'Agência', placeholder: '0000' },
    { key: 'branch_digit', label: 'Dígito Agência', placeholder: '0' },
    { key: 'account', label: 'Conta Corrente', placeholder: '00000' },
    { key: 'account_digit', label: 'Dígito Conta', placeholder: '0' },
    { key: 'transmission_code', label: 'Código de Transmissão / Convênio', placeholder: 'Código de convênio fornecido pelo banco' },
    { key: 'cnpj', label: 'CNPJ da Conta', placeholder: '00.000.000/0000-00' }
];

const CUSTOM_API_FIELDS: BankField[] = [
    { key: 'api_url', label: 'URL Base da API (Endpoint)', placeholder: 'https://api.exemplo.com/v1' },
    { key: 'client_id', label: 'Client ID', placeholder: 'Chave de acesso da API' },
    { key: 'client_secret', label: 'Client Secret', placeholder: 'Segredo ou senha de acesso', type: 'password' },
    { key: 'certificate_pem', label: 'Certificado Público (PEM)', placeholder: 'Cole o certificado público (PEM) aqui', type: 'textarea' },
    { key: 'private_key_pem', label: 'Chave Privada (PEM)', placeholder: 'Cole a chave privada (PEM) aqui', type: 'textarea_hidden' }
];

const resolveProvider = (providerId: string, bankConfig?: any) => {
    const homologated = BANK_PROVIDERS.find(p => p.id === providerId);
    if (homologated) return homologated;

    if (providerId.startsWith('custom_')) {
        const customName = bankConfig?.config?.custom_name || 'Banco Personalizado';
        const customType = bankConfig?.config?.custom_type || 'cnab240';
        return {
            id: providerId,
            name: customName,
            desc: customType === 'api' ? 'Integração via API personalizada.' : 'Remessa via arquivo CNAB 240 personalizado.',
            isCustom: true,
            fields: customType === 'api' ? CUSTOM_API_FIELDS : CUSTOM_CNAB_FIELDS
        };
    }

    return {
        id: providerId,
        name: 'Banco Outros',
        desc: 'Integração bancária genérica.',
        fields: CUSTOM_CNAB_FIELDS
    };
};

export function BankingSettings() {
    const { currentEntity, availableEntities, refresh: refreshEntity } = useEntity();
    const { configs, loading, saveConfig, deleteConfig, testConnection } = useBankingSettings();
    const { notify } = useNotification();

    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [ddaEnabled, setDdaEnabled] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [config, setConfig] = useState<Record<string, any>>({});
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [togglingModule, setTogglingModule] = useState(false);

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addTab, setAddTab] = useState<'homologated' | 'custom'>('homologated');
    const [customName, setCustomName] = useState('');
    const [customType, setCustomType] = useState<'cnab240' | 'api'>('cnab240');

    const isCompany = currentEntity && currentEntity.type === 'company';
    const isModuleEnabled = isCompany ? !!currentEntity.banking_module_enabled : false;

    const companies = availableEntities.filter(e => e.type === 'company');
    const hasMultipleCompanies = companies.length > 1;

    // Carrega configuração local quando um provedor de banco é selecionado
    const handleSelectProvider = (providerId: string) => {
        setSelectedProvider(providerId);
        const existing = configs.find(c => c.provider === providerId);

        if (existing) {
            setDdaEnabled(existing.dda_enabled);
            setIsActive(existing.is_active);
            setConfig(existing.config || {});
        } else {
            setDdaEnabled(false);
            setIsActive(true);
            // Se for um banco customizado sendo recém criado, mantém os metadados
            if (providerId.startsWith('custom_') && config.custom_name && config.custom_type) {
                // mantém metadados
            } else {
                setConfig({});
            }
        }
    };

    // Toggle para o módulo bancário inteiro nas configurações da empresa
    const handleToggleModule = async () => {
        if (!isCompany) return;
        setTogglingModule(true);
        const nextStatus = !isModuleEnabled;

        try {
            const { error } = await supabase
                .from('companies')
                .update({ banking_module_enabled: nextStatus })
                .eq('id', currentEntity.id);

            if (error) throw error;
            await refreshEntity();
            notify('success', `Módulo Bancário ${nextStatus ? 'ativado' : 'desativado'} com sucesso!`, 'Módulo Atualizado');
        } catch (err: any) {
            notify('error', err.message || 'Erro ao atualizar módulo bancário.', 'Erro');
        } finally {
            setTogglingModule(false);
        }
    };

    const handleSave = async () => {
        if (!selectedProvider) return;

        // 1. Testa a conexão primeiro para garantir chaves válidas
        setTesting(true);
        try {
            const testResult = await testConnection(selectedProvider, config);
            if (!testResult.success) {
                notify('error', testResult.message, 'Falha na Validação');
                setTesting(false);
                return;
            }
            notify('success', 'Credenciais verificadas!', 'Sucesso');
        } catch (err) {
            notify('error', 'Não foi possível validar as credenciais agora.', 'Erro de Conexão');
            setTesting(false);
            return;
        } finally {
            setTesting(false);
        }

        // 2. Salva a configuração no banco
        setSaving(true);
        const finalConfig = { ...config };
        if (!hasMultipleCompanies) {
            finalConfig.cnpj = currentEntity.cnpj || '';
        }

        const { error } = await saveConfig({
            provider: selectedProvider,
            is_active: isActive,
            dda_enabled: ddaEnabled,
            config: finalConfig
        });

        setSaving(false);
        if (error) {
            notify('error', (error as any).message || 'Erro ao salvar configurações.', 'Erro ao Salvar');
        } else {
            notify('success', 'Configurações de integração bancária salvas com sucesso!', 'Salvo!');
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Carregando integrações bancárias...</div>;

    // Resolve as configurações e novos bancos para exibição na barra lateral
    const visibleProviders: any[] = configs.map(c => {
        const resolved = resolveProvider(c.provider, c);
        return {
            id: c.provider,
            name: resolved.name,
            desc: resolved.desc,
            is_active: c.is_active,
            dda_enabled: c.dda_enabled,
            isConfigured: true
        };
    });

    // Se houver um novo banco selecionado mas que ainda não está salvo no banco, adiciona como item temporário
    if (selectedProvider && !configs.some(c => c.provider === selectedProvider)) {
        let tempProvider: any = null;
        if (selectedProvider.startsWith('custom_')) {
            tempProvider = {
                id: selectedProvider,
                name: config.custom_name || 'Banco Personalizado',
                desc: config.custom_type === 'api' ? 'Integração via API personalizada.' : 'Remessa via arquivo CNAB 240 personalizado.',
                is_active: isActive,
                dda_enabled: ddaEnabled,
                isConfigured: false
            };
        } else {
            const homologated = BANK_PROVIDERS.find(p => p.id === selectedProvider);
            if (homologated) {
                tempProvider = {
                    id: selectedProvider,
                    name: homologated.name,
                    desc: homologated.desc,
                    is_active: isActive,
                    dda_enabled: ddaEnabled,
                    isConfigured: false
                };
            }
        }
        if (tempProvider) {
            visibleProviders.push(tempProvider);
        }
    }

    const availableTemplates = BANK_PROVIDERS.filter(p => !configs.some(c => c.provider === p.id));
    const currentProviderDetails = selectedProvider 
        ? resolveProvider(selectedProvider, configs.find(c => c.provider === selectedProvider) || { config })
        : null;

    return (
        <div className="space-y-6">
            {/* Header da Página */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 rounded-xl">
                    <Landmark size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bancos e DDA</h1>
                    <p className="text-gray-500">Configuração de contas bancárias, credenciais de APIs de pagamentos e DDA automático.</p>
                </div>
            </div>

            {/* Master Switch - Habilitação do Módulo na Empresa */}
            <div className="flex items-center justify-between p-6 rounded-2xl border-2 border-indigo-100 dark:border-indigo-950 bg-indigo-50/20 dark:bg-indigo-950/10">
                <div className="flex items-center gap-6">
                    <div className="p-4 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600">
                        <Shield size={32} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Status do Módulo Bancário</h3>
                        <p className="text-sm text-gray-500">Ative o módulo de integrações bancárias para enviar arquivos CNAB de Contas a Pagar e consultar DDA.</p>
                    </div>
                </div>
                <label className={`relative inline-flex items-center cursor-pointer scale-125 ${togglingModule ? 'opacity-50 cursor-wait' : ''}`}>
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isModuleEnabled}
                        disabled={togglingModule}
                        onChange={handleToggleModule}
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                </label>
            </div>

            {isModuleEnabled ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Lista de Bancos/Integrações à Esquerda */}
                    <div className="lg:col-span-1 space-y-4">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Bancos Configurados</h4>
                        
                        <div className="space-y-2">
                            {visibleProviders.map(provider => {
                                return (
                                    <button
                                        key={provider.id}
                                        onClick={() => handleSelectProvider(provider.id)}
                                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedProvider === provider.id
                                            ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-600'
                                            : 'border-gray-200 dark:border-slate-700 hover:border-indigo-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${provider.isConfigured ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                                <Landmark size={20} />
                                            </div>
                                            <div className="text-left">
                                                <span className="block font-medium dark:text-white text-sm">{provider.name}</span>
                                                <span className="text-[10px] text-gray-500">
                                                    {provider.isConfigured ? (provider.dda_enabled ? 'DDA Ativo' : 'DDA Inativo') : 'Não Salvo'}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            {provider.isConfigured ? (
                                                provider.is_active ? (
                                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                                                        ATIVO
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] bg-gray-100 text-gray-400 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                                        INATIVO
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                                                    NOVO
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}

                            <Button 
                                variant="outline" 
                                onClick={() => setIsAddModalOpen(true)}
                                className="w-full flex items-center justify-center gap-2 py-3 border-dashed border-2 hover:bg-gray-50 dark:hover:bg-slate-800/30 border-indigo-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-medium"
                            >
                                <Plus size={18} />
                                Adicionar Banco
                            </Button>
                        </div>
                    </div>

                    {/* Formulário de Configuração à Direita */}
                    <div className="lg:col-span-2">
                        {selectedProvider ? (
                            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-700">
                                    <div>
                                        <h4 className="text-lg font-bold dark:text-white">
                                            {currentProviderDetails?.name}
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {currentProviderDetails?.desc}
                                        </p>
                                    </div>
                                    {configs.find(c => c.provider === selectedProvider) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                            onClick={() => {
                                                const configObj = configs.find(c => c.provider === selectedProvider);
                                                if (configObj && confirm('Excluir esta configuração bancária?')) {
                                                    deleteConfig(configObj.id);
                                                    setSelectedProvider('');
                                                }
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    )}
                                </div>

                                {/* Toggle específico de Ativação do Banco */}
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="text-indigo-600">
                                            <Power size={20} />
                                        </div>
                                        <div>
                                            <span className="block text-sm font-semibold dark:text-white">Status da Integração</span>
                                            <span className="block text-xs text-gray-400">Ativar este banco para geração de pagamentos e DDA.</span>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isActive}
                                            onChange={() => setIsActive(!isActive)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                {/* Toggle específico de DDA */}
                                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="text-indigo-600">
                                            <Sparkles size={20} />
                                        </div>
                                        <div>
                                            <span className="block text-sm font-semibold dark:text-white">Varredura Automática de DDA</span>
                                            <span className="block text-xs text-gray-400">Buscar automaticamente boletos de fornecedores registrados neste banco.</span>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={ddaEnabled}
                                            onChange={() => setDdaEnabled(!ddaEnabled)}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                {/* Campos Dinâmicos do Formulário */}
                                <div className="space-y-4">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        Configurações de Acesso
                                    </div>
                                    
                                    {currentProviderDetails?.fields.map(field => {
                                        if (field.key === 'cnpj' && !hasMultipleCompanies) {
                                            return (
                                                <div key={field.key} className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                                                        {field.label}
                                                    </label>
                                                    <div className="px-3 py-2 border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 rounded-lg text-sm text-gray-500 dark:text-gray-400">
                                                        {currentEntity.cnpj || 'Sem CNPJ cadastrado'}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400">Preenchido automaticamente a partir do cadastro da empresa.</p>
                                                </div>
                                            );
                                        }

                                        if (field.type === 'textarea' || field.type === 'textarea_hidden') {
                                            return (
                                                <div key={field.key} className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                                                        {field.label}
                                                    </label>
                                                    <TextArea
                                                        value={config[field.key] || ''}
                                                        onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                        placeholder={field.placeholder}
                                                        rows={4}
                                                        className="font-mono text-xs dark:bg-slate-900 dark:border-slate-700"
                                                    />
                                                </div>
                                            );
                                        }

                                        return (
                                            <Input
                                                key={field.key}
                                                label={field.label}
                                                type={field.type || 'text'}
                                                value={config[field.key] || ''}
                                                onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                placeholder={field.placeholder}
                                                autoComplete="off"
                                                className="dark:bg-slate-900 dark:border-slate-700"
                                            />
                                        );
                                    })}

                                    <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-900/10 flex gap-3">
                                        <Info className="text-blue-600" size={20} />
                                        <div className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                                            <strong>Segurança:</strong> As credenciais e chaves privadas fornecidas são criptografadas e armazenadas em ambiente seguro. Elas são transmitidas apenas para a validação das assinaturas bancárias.
                                        </div>
                                    </div>

                                    {/* Ações de Salvar e Testar */}
                                    <div className="pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
                                        <Button
                                            onClick={handleSave}
                                            isLoading={saving || testing}
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            <Save size={18} className="mr-2" />
                                            {testing ? 'Testando credenciais...' : saving ? 'Salvando...' : 'Salvar Configurações'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-gray-500 p-8 bg-white dark:bg-slate-800/30">
                                <Landmark size={48} className="mb-4 opacity-20 text-indigo-500" />
                                <p className="text-center font-medium mb-4">Nenhum banco configurado para esta empresa.</p>
                                <Button 
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    Adicionar Primeira Integração
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-800/30 text-gray-500 space-y-4">
                    <Landmark size={48} className="mx-auto opacity-30 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Integração Bancária Desabilitada</h3>
                    <p className="max-w-md mx-auto text-sm text-gray-500">Ative o "Status do Módulo Bancário" acima para liberar o painel de configuração de contas e DDA automático.</p>
                </div>
            )}

            {/* Modal de Adicionar Banco */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-in fade-in duration-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Adicionar Nova Integração Bancária</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Selecione um banco homologado ou crie um banco customizado.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        
                        {/* Modal Tabs */}
                        <div className="flex border-b border-gray-100 dark:border-slate-700">
                            <button
                                onClick={() => setAddTab('homologated')}
                                className={`flex-1 py-3 text-center font-medium text-sm border-b-2 transition-all ${addTab === 'homologated'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Bancos Homologados
                            </button>
                            <button
                                onClick={() => setAddTab('custom')}
                                className={`flex-1 py-3 text-center font-medium text-sm border-b-2 transition-all ${addTab === 'custom'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Banco Personalizado
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-1 max-h-[50vh]">
                            {addTab === 'homologated' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {availableTemplates.length > 0 ? (
                                        availableTemplates.map(template => (
                                            <button
                                                key={template.id}
                                                onClick={() => {
                                                    handleSelectProvider(template.id);
                                                    setIsAddModalOpen(false);
                                                }}
                                                className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10 text-left transition-all group"
                                            >
                                                <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                                    <Landmark size={24} />
                                                </div>
                                                <div>
                                                    <span className="block font-semibold text-gray-800 dark:text-white text-sm">{template.name}</span>
                                                    <span className="block text-[11px] text-gray-400 mt-0.5">{template.desc}</span>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="col-span-2 text-center text-gray-500 py-8">
                                            Todos os bancos homologados já foram adicionados!
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4 max-w-md mx-auto py-4">
                                    <Input
                                        label="Nome do Banco"
                                        placeholder="Ex: Banco Ailos, Caixa Federal, etc."
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                        className="dark:bg-slate-900"
                                    />
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                                            Tipo de Integração
                                        </label>
                                        <select
                                            value={customType}
                                            onChange={e => setCustomType(e.target.value as any)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-900 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-600 dark:text-white"
                                        >
                                            <option value="cnab240">Arquivo CNAB 240 (Remessa/Retorno)</option>
                                            <option value="api">Conexão via API (Tempo Real)</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 bg-gray-50 dark:bg-slate-800/50">
                            <Button
                                variant="ghost"
                                onClick={() => setIsAddModalOpen(false)}
                            >
                                Cancelar
                            </Button>
                            {addTab === 'custom' && (
                                <Button
                                    onClick={() => {
                                        if (!customName.trim()) {
                                            notify('error', 'Por favor, digite o nome do banco.', 'Campo Obrigatório');
                                            return;
                                        }
                                        const newId = 'custom_' + Date.now();
                                        setIsActive(true);
                                        setDdaEnabled(false);
                                        // Inicializa metadados do banco personalizado
                                        setConfig({
                                            custom_name: customName,
                                            custom_type: customType === 'api' ? 'api' : 'cnab'
                                        });
                                        setSelectedProvider(newId);
                                        setIsAddModalOpen(false);
                                        setCustomName('');
                                        notify('success', 'Banco personalizado criado! Agora preencha os dados e salve.', 'Criado com Sucesso');
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    Criar Banco
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
