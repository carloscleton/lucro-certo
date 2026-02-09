import { useState, useEffect } from 'react';
import { CreditCard, Save, Trash2, Power, Info, FlaskConical, Rocket, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { usePaymentGateways } from '../../hooks/usePaymentGateways';
import { useEntity } from '../../context/EntityContext';
import { useNotification } from '../../context/NotificationContext';

const PROVIDERS = [
    {
        id: 'mercado_pago', name: 'Mercado Pago', fields: [
            { key: 'public_key', label: 'Public Key', placeholder: 'APP_USR-...' },
            { key: 'access_token', label: 'Access Token', placeholder: 'APP_USR-...', type: 'password' }
        ]
    },
    {
        id: 'stripe', name: 'Stripe', fields: [
            { key: 'publishable_key', label: 'Publishable Key', placeholder: 'pk_test_...' },
            { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_test_...', type: 'password' }
        ]
    },
    {
        id: 'asaas', name: 'Asaas', fields: [
            { key: 'api_key', label: 'API Key', placeholder: '$...', type: 'password' }
        ]
    }
];

export function PaymentSettings() {
    const { currentEntity } = useEntity();
    const { gateways, loading, saveGateway, toggleGateway, deleteGateway, testConnection } = usePaymentGateways();
    const { notify } = useNotification();
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [isSandbox, setIsSandbox] = useState(true);
    const [config, setConfig] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const isOwner = currentEntity.role === 'owner';

    // Force Production for Admins
    useEffect(() => {
        if (!isOwner && isSandbox) {
            setIsSandbox(false);
        }
    }, [isOwner, isSandbox]);

    // Load initial environment and config when provider is SELECTED
    const handleSelectProvider = (providerId: string) => {
        setSelectedProvider(providerId);
        const existing = gateways.find(g => g.provider === providerId);

        if (existing) {
            setIsSandbox(existing.is_sandbox);

            // Load correct keys based on environment
            const fullConfig = existing.config || {};
            const providerDef = PROVIDERS.find(p => p.id === providerId);
            const newLocalConfig: Record<string, string> = {};

            providerDef?.fields.forEach(field => {
                const envKey = existing.is_sandbox ? `sandbox_${field.key}` : `prod_${field.key}`;
                newLocalConfig[field.key] = fullConfig[envKey] || '';
            });
            setConfig(newLocalConfig);
        } else {
            setIsSandbox(true);
            setConfig({});
        }
    };

    // Update LOCAL config state when user toggles environment manually
    useEffect(() => {
        if (!selectedProvider) return;
        const existing = gateways.find(g => g.provider === selectedProvider);
        if (!existing) return;

        const fullConfig = existing.config || {};
        const providerDef = PROVIDERS.find(p => p.id === selectedProvider);
        const newLocalConfig: Record<string, string> = {};

        providerDef?.fields.forEach(field => {
            const envKey = isSandbox ? `sandbox_${field.key}` : `prod_${field.key}`;
            newLocalConfig[field.key] = fullConfig[envKey] || '';
        });
        setConfig(newLocalConfig);
    }, [isSandbox, selectedProvider, gateways]);

    const handleSave = async () => {
        if (!selectedProvider) return;

        // 1. Prepare full config matching what backend expects
        const existing = gateways.find(g => g.provider === selectedProvider);
        const fullConfig = existing?.config || {};

        const providerDef = PROVIDERS.find(p => p.id === selectedProvider);
        providerDef?.fields.forEach(field => {
            const envKey = isSandbox ? `sandbox_${field.key}` : `prod_${field.key}`;
            fullConfig[envKey] = config[field.key] || '';
        });

        // 2. Test Connection FIRST
        setTesting(true);
        try {
            const testResult = await testConnection(selectedProvider, fullConfig, isSandbox);

            if (!testResult.success) {
                notify('error', testResult.message || 'Falha na comunicação com o gateway.', 'Erro de Credenciais');
                setTesting(false);
                return;
            }

            notify('success', 'Conexão validada com sucesso!', 'Gateway Online');
        } catch (err) {
            notify('error', 'Não foi possível testar as credenciais agora.', 'Erro de Conexão');
            setTesting(false);
            return;
        } finally {
            setTesting(false);
        }

        // 3. If test passed, proceed to SAVE with verification timestamp
        setSaving(true);
        const { error } = await saveGateway({
            provider: selectedProvider as any,
            is_active: true,
            is_sandbox: isSandbox,
            config: fullConfig,
            last_verified_at: new Date().toISOString()
        } as any);

        setSaving(false);
        if (error) {
            notify('error', (error as any).message || 'Erro ao persistir configuração no banco.', 'Falha ao Salvar');
        } else {
            notify('success', 'Configurações salvas e gateway ativado.', 'Sucesso!');
        }
    };

    const handleToggle = async (gatewayId: string, currentStatus: boolean) => {
        try {
            const { error } = await toggleGateway(gatewayId, !currentStatus);
            if (error) throw error;
            notify('success', `Gateway ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`, 'Status Atualizado');
        } catch (err: any) {
            notify('error', err.message || 'Erro ao alterar status do gateway.', 'Erro');
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Carregando gateways...</div>;

    return (
        <div className="space-y-8">
            <div className="flex items-start gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                <CreditCard className="text-emerald-600 mt-1" size={24} />
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Gateways de Pagamento</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Configure seus meios de recebimento. Você pode alternar entre ambientes de <strong>Teste</strong> e <strong>Produção</strong> para validar suas integrações.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Provider List */}
                <div className="lg:col-span-1 space-y-4">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Provedores Disponíveis</h4>
                    <div className="space-y-2">
                        {PROVIDERS.map(provider => {
                            const gateway = gateways.find(g => g.provider === provider.id);
                            return (
                                <button
                                    key={provider.id}
                                    onClick={() => handleSelectProvider(provider.id)}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedProvider === provider.id
                                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-600'
                                        : 'border-gray-200 dark:border-slate-700 hover:border-emerald-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${gateway ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                            <CreditCard size={20} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-medium dark:text-white">{provider.name}</span>
                                            <span className="text-xs text-gray-500">
                                                {gateway ? (gateway.is_sandbox ? 'Modo Teste' : 'Modo Produção') : 'Não Configurado'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {gateway && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggle(gateway.id, gateway.is_active);
                                                }}
                                                className={`p-1 rounded-md transition-colors ${gateway.is_active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-300 hover:bg-gray-100'}`}
                                                title={gateway.is_active ? 'Desativar Gateway' : 'Ativar Gateway'}
                                            >
                                                <Power size={18} />
                                            </button>
                                        )}
                                        {gateway?.last_verified_at && (
                                            <div className="flex items-center justify-center bg-emerald-500 text-white rounded-full p-0.5" title={`Verificado em: ${new Date(gateway.last_verified_at).toLocaleString()}`}>
                                                <CheckCircle2 size={10} strokeWidth={3} />
                                            </div>
                                        )}
                                        {gateway?.is_active && (
                                            <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] ${gateway.last_verified_at ? 'bg-emerald-500' : (gateway.is_sandbox ? 'bg-amber-400' : 'bg-emerald-500')}`} />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Configuration Area */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedProvider ? (
                        <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h4 className="text-lg font-bold dark:text-white">
                                    Configurar {PROVIDERS.find(p => p.id === selectedProvider)?.name}
                                </h4>
                                <div className="flex items-center gap-4">
                                    {gateways.find(g => g.provider === selectedProvider) && (
                                        <div className="flex items-center gap-2 pr-4 border-r border-gray-100 dark:border-slate-700">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</span>
                                            <button
                                                onClick={() => {
                                                    const g = gateways.find(gw => gw.provider === selectedProvider);
                                                    if (g) handleToggle(g.id, g.is_active);
                                                }}
                                                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${gateways.find(g => g.provider === selectedProvider)?.is_active
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'
                                                    }`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${gateways.find(g => g.provider === selectedProvider)?.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                                {gateways.find(g => g.provider === selectedProvider)?.is_active ? 'ATIVO' : 'INATIVO'}
                                            </button>
                                        </div>
                                    )}
                                    {gateways.find(g => g.provider === selectedProvider) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:bg-red-50"
                                            onClick={() => {
                                                const g = gateways.find(gw => gw.provider === selectedProvider);
                                                if (g && confirm('Remover configuração deste gateway?')) deleteGateway(g.id);
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Environment Toggle - Only for Owner */}
                            {isOwner && (
                                <div className="mb-8 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl flex">
                                    <button
                                        onClick={() => setIsSandbox(true)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${isSandbox
                                            ? 'bg-white dark:bg-slate-700 text-amber-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        <FlaskConical size={16} />
                                        Ambiente de Teste (Sandbox)
                                    </button>
                                    <button
                                        onClick={() => setIsSandbox(false)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${!isSandbox
                                            ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        <Rocket size={16} />
                                        Ambiente de Produção
                                    </button>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                                    {isSandbox ? 'Credenciais de Teste' : 'Credenciais Reais'}
                                </div>
                                {PROVIDERS.find(p => p.id === selectedProvider)?.fields.map(field => (
                                    <Input
                                        key={field.key}
                                        label={field.label}
                                        type={field.type || 'text'}
                                        value={config[field.key] || ''}
                                        onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        placeholder={`${isSandbox ? '[Sandbox] ' : ''}${field.placeholder}`}
                                    />
                                ))}

                                <div className={`p-4 rounded-xl border flex gap-3 ${isSandbox
                                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'
                                    : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
                                    }`}>
                                    <Info className={isSandbox ? 'text-amber-600' : 'text-emerald-600'} size={20} />
                                    <div className={`text-xs ${isSandbox ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-800 dark:text-emerald-200'}`}>
                                        <strong>Dica:</strong> {isSandbox
                                            ? 'Utilize cartões de teste e usuários sandbox do provedor para validar o fluxo sem custos reais.'
                                            : 'Ao salvar em modo produção, as cobranças geradas serão reais e descontadas dos clientes.'}
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3">
                                    <Button
                                        onClick={handleSave}
                                        isLoading={saving || testing}
                                        className={isSandbox ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                                    >
                                        <Save size={18} className="mr-2" />
                                        {testing ? 'Testando Conexão...' : saving ? 'Salvando...' : `Salvar e Ativar ${isSandbox ? 'Modo Teste' : 'Modo Produção'}`}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-gray-500 p-8">
                            <Power size={48} className="mb-4 opacity-20" />
                            <p className="text-center font-medium">Selecione um provedor à esquerda para configurar as credenciais.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
