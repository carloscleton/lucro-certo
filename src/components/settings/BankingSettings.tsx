import { useState } from 'react';
import { Landmark, Save, Trash2, Power, Info, ToggleLeft, ToggleRight, Shield, Sparkles } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { useBankingSettings } from '../../hooks/useBankingSettings';
import { useEntity } from '../../context/EntityContext';
import { useNotification } from '../../context/NotificationContext';
import { supabase } from '../../lib/supabase';

const BANK_PROVIDERS = [
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
    }
];

export function BankingSettings() {
    const { currentEntity, refresh: refreshEntity } = useEntity();
    const { configs, loading, saveConfig, toggleConfig, deleteConfig, testConnection } = useBankingSettings();
    const { notify } = useNotification();

    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [ddaEnabled, setDdaEnabled] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [config, setConfig] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [togglingModule, setTogglingModule] = useState(false);

    const isCompany = currentEntity && currentEntity.type === 'company';
    const isModuleEnabled = isCompany ? !!currentEntity.banking_module_enabled : false;

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
            setConfig({});
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
        const { error } = await saveConfig({
            provider: selectedProvider as any,
            is_active: isActive,
            dda_enabled: ddaEnabled,
            config: config
        });

        setSaving(false);
        if (error) {
            notify('error', (error as any).message || 'Erro ao salvar configurações.', 'Erro ao Salvar');
        } else {
            notify('success', 'Configurações de integração bancária salvas com sucesso!', 'Salvo!');
        }
    };

    const handleToggleActive = async (configId: string, currentStatus: boolean) => {
        try {
            const { error } = await toggleConfig(configId, !currentStatus);
            if (error) throw error;
            notify('success', `Banco ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`, 'Status Atualizado');
        } catch (err: any) {
            notify('error', err.message || 'Erro ao alterar status.', 'Erro');
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Carregando integrações bancárias...</div>;

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
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Bancos Disponíveis</h4>
                        <div className="space-y-2">
                            {BANK_PROVIDERS.map(provider => {
                                const bankConfig = configs.find(c => c.provider === provider.id);
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
                                            <div className={`p-2 rounded-lg ${bankConfig ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                                <Landmark size={20} />
                                            </div>
                                            <div className="text-left">
                                                <span className="block font-medium dark:text-white text-sm">{provider.name}</span>
                                                <span className="text-[10px] text-gray-500">
                                                    {bankConfig ? (bankConfig.dda_enabled ? 'DDA Ativo' : 'DDA Inativo') : 'Não Configurado'}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            {bankConfig ? (
                                                bankConfig.is_active ? (
                                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold">
                                                        ATIVO
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] bg-gray-100 text-gray-400 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                                        INATIVO
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-[10px] bg-gray-50 text-gray-300 dark:bg-slate-800 dark:text-slate-600 px-2 py-0.5 rounded-full">
                                                    Vazio
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Formulário de Configuração à Direita */}
                    <div className="lg:col-span-2">
                        {selectedProvider ? (
                            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-700">
                                    <div>
                                        <h4 className="text-lg font-bold dark:text-white">
                                            {BANK_PROVIDERS.find(p => p.id === selectedProvider)?.name}
                                        </h4>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {BANK_PROVIDERS.find(p => p.id === selectedProvider)?.desc}
                                        </p>
                                    </div>
                                    {configs.find(c => c.provider === selectedProvider) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:bg-red-50"
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
                                    <button
                                        type="button"
                                        onClick={() => setIsActive(!isActive)}
                                        className="text-indigo-600 transition-colors"
                                    >
                                        {isActive ? <ToggleRight size={40} /> : <ToggleLeft size={40} className="text-gray-400" />}
                                    </button>
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
                                    <button
                                        type="button"
                                        onClick={() => setDdaEnabled(!ddaEnabled)}
                                        className="text-indigo-600 transition-colors"
                                    >
                                        {ddaEnabled ? <ToggleRight size={40} /> : <ToggleLeft size={40} className="text-gray-400" />}
                                    </button>
                                </div>

                                {/* Campos Dinâmicos do Formulário */}
                                <div className="space-y-4">
                                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        Configurações de Acesso
                                    </div>
                                    
                                    {BANK_PROVIDERS.find(p => p.id === selectedProvider)?.fields.map(field => {
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
                                <p className="text-center font-medium">Selecione um banco à esquerda para configurar a integração.</p>
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
        </div>
    );
}
