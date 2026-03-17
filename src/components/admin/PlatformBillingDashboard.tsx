import { useState, useEffect } from 'react';
import {
    Users,
    AlertTriangle,
    Clock,
    TrendingUp,
    Search,
    ArrowUpRight,
    DollarSign,
    RefreshCw,
    CheckCircle,
    Zap as ZapIcon,
    Wand2,
    Save,
    Activity,
    CreditCard,
    Calendar,
    X,
    ExternalLink
} from 'lucide-react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { Input } from '../ui/Input';
import { useTranslation } from 'react-i18next';
import { useAdmin } from '../../hooks/useAdmin';
import { AdminBICharts } from './AdminBICharts';
import { useNotification } from '../../context/NotificationContext';

export function PlatformBillingDashboard() {
    const { t } = useTranslation();
    const {
        appSettings,
        updateAppSettings,
        companiesList,
        refresh,
        loading: adminLoading,
        biStats,
        manualRenewSubscription,
        setCompanyTrial,
        toggleCompanyBlock
    } = useAdmin();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'past_due' | 'trial'>('all');
    const [isGeneratingWhatsApp, setIsGeneratingWhatsApp] = useState(false);
    const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [localKeys, setLocalKeys] = useState<any>({});
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedCompanyName, setSelectedCompanyName] = useState<string>('');
    const [billingHistory, setBillingHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const { notify } = useNotification();
    const { testPlatformConnection, fetchCompanyCharges } = useAdmin();

    // Sync local keys when appSettings loads - Triggering fresh Vercel build
    useEffect(() => {
        if (appSettings?.platform_billing_config) {
            setLocalKeys(appSettings.platform_billing_config);
        }
    }, [appSettings]);

    const handleSaveSettings = async (settingsToSave?: any) => {
        setSaving(true);
        const finalSettings = settingsToSave || { platform_billing_config: localKeys };
        const { error } = await updateAppSettings(finalSettings);
        setSaving(false);
        if (error) {
            alert('Erro ao salvar: ' + error);
        } else {
            refresh();
        }
    };

    const updateNestedKey = (provider: string, env: 'sandbox' | 'production', key: string, value: string) => {
        setLocalKeys((prev: any) => ({
            ...prev,
            [provider]: {
                ...((prev as any)[provider] || {}),
                [env]: {
                    ...(((prev as any)[provider]?.[env]) || {}),
                    [key]: value
                }
            }
        }));
    };

    const currentEnv = appSettings?.platform_billing_sandbox ? 'sandbox' : 'production';

    const handleMagicTemplate = async (type: 'whatsapp' | 'email') => {
        const setGenerating = type === 'whatsapp' ? setIsGeneratingWhatsApp : setIsGeneratingEmail;
        setGenerating(true);
        try {
            const { data, error } = await supabase.functions.invoke('lead-radar-magic', {
                body: {
                    input: `Empresa: Lucro Certo. Gere um template profissional de ${type === 'whatsapp' ? 'WhatsApp' : 'E-mail HTML'} para cobrança de mensalidade próxima do vencimento. Use um tom amigável e educado. Use obrigatoriamente as variáveis: {company_name}, {due_date}, {days}, {value}, {payment_link}.`,
                    mode: 'field_only'
                }
            });
            if (error) throw error;
            if (data?.text) {
                await updateAppSettings({ [type === 'whatsapp' ? 'billing_whatsapp_template' : 'billing_email_template']: data.text });
                refresh();
            }
        } catch (error) {
            console.error('Magic error:', error);
        } finally {
            setGenerating(false);
        }
    };

    const handleViewHistory = async (companyId: string, companyName: string) => {
        setSelectedCompanyName(companyName);
        setHistoryModalOpen(true);
        setLoadingHistory(true);
        
        const { error, charges } = await fetchCompanyCharges(companyId);
        setLoadingHistory(false);
        
        if (error) {
            notify('error', 'Falha ao carregar o histórico de cobranças: ' + error, 'Erro');
        } else {
            setBillingHistory(charges || []);
        }
    };

    // Stats calc
    const stats = {
        totalActive: companiesList.filter(c => c.subscription_status === 'active' && c.subscription_plan !== 'trial').length,
        totalTrials: companiesList.filter(c => c.subscription_plan === 'trial').length,
        totalPastDue: companiesList.filter(c => c.subscription_status === 'past_due').length,
        estimatedRevenue: companiesList
            .filter(c => c.subscription_status === 'active' && c.subscription_plan !== 'trial')
            .reduce((acc, c) => acc + (Number(c.next_billing_value) || 0), 0)
    };

    const filteredCompanies = companiesList.filter(c => {
        const matchesSearch = c.trade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.owner_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' ||
            (filterStatus === 'trial' ? c.subscription_plan === 'trial' : c.subscription_status === filterStatus);
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="space-y-6">
            {/* Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div
                    onClick={() => setFilterStatus('active')}
                    className={`p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 ${filterStatus === 'active' ? 'border-emerald-500 shadow-emerald-100 dark:shadow-emerald-900/20' : 'border-transparent shadow-sm hover:border-emerald-200'}`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Receita Mensal Est.</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.estimatedRevenue)}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <ArrowUpRight size={14} />
                        <span>Baseado em assinantes Pro</span>
                    </div>
                </div>

                <div
                    onClick={() => setFilterStatus('active')}
                    className={`p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500 ${filterStatus === 'active' ? 'border-blue-500 shadow-blue-100 dark:shadow-blue-900/20' : 'border-transparent shadow-sm hover:border-blue-200'}`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Users size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assinantes Pro</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalActive}</div>
                    <div className="mt-2 text-xs text-gray-500">Planos ativos e pagos</div>
                </div>

                <div
                    onClick={() => setFilterStatus('trial')}
                    className={`p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-700 ${filterStatus === 'trial' ? 'border-orange-500 shadow-orange-100 dark:shadow-orange-900/20' : 'border-transparent shadow-sm hover:border-orange-200'}`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                            <Clock size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Em Teste (Trial)</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalTrials}</div>
                    <div className="mt-2 text-xs text-gray-500">Aguardando conversão</div>
                </div>

                <div
                    onClick={() => setFilterStatus('past_due')}
                    className={`p-5 bg-white dark:bg-slate-800 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-1000 ${filterStatus === 'past_due' ? 'border-red-500 shadow-red-100 dark:shadow-red-900/20' : 'border-transparent shadow-sm hover:border-red-200'}`}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                            <AlertTriangle size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pendentes/Atrasados</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalPastDue}</div>
                    <div className="mt-2 text-xs text-red-500 font-medium">Requer atenção comercial</div>
                </div>
            </div>

            {/* BI Performance Charts */}
            <AdminBICharts data={biStats} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gateway Config Section (Moved here) */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <DollarSign size={20} />
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Configuração de Faturamento</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Provedor Ativo</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['asaas', 'stripe', 'mercadopago'].map((provider) => (
                                        <button
                                            key={provider}
                                            disabled={adminLoading || saving}
                                            onClick={() => handleSaveSettings({ platform_billing_provider: provider as any })}
                                            className={`py-2 px-3 rounded-lg border text-[10px] font-bold capitalize transition-all ${appSettings?.platform_billing_provider === provider
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                                                : 'bg-white dark:bg-slate-900 text-gray-500 border-gray-200 dark:border-slate-700 hover:border-gray-300'
                                                }`}
                                        >
                                            {provider}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {appSettings?.platform_billing_provider && (
                                <div className="mb-4 p-1 bg-gray-100 dark:bg-slate-900 rounded-xl flex items-center justify-between">
                                    <div className="flex bg-white dark:bg-slate-700 rounded-lg p-0.5 shadow-sm">
                                        <button
                                            onClick={() => handleSaveSettings({ platform_billing_sandbox: true })}
                                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${appSettings?.platform_billing_sandbox
                                                ? 'bg-amber-500 text-white shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Sandbox
                                        </button>
                                        <button
                                            onClick={() => handleSaveSettings({ platform_billing_sandbox: false })}
                                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${!appSettings?.platform_billing_sandbox
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Produção
                                        </button>
                                    </div>
                                    <span className="text-[9px] font-medium text-gray-500 pr-3 uppercase tracking-tighter">
                                        {appSettings?.platform_billing_sandbox ? 'Modo de Teste' : 'Transações Reais'}
                                    </span>
                                </div>
                            )}

                            {appSettings?.platform_billing_provider === 'asaas' && (
                                <div className="space-y-4">
                                    <Input
                                        label={`API Key Asaas [${currentEnv.toUpperCase()}]`}
                                        type="password"
                                        value={(localKeys as any).asaas?.[currentEnv]?.api_key || ''}
                                        onChange={(e) => updateNestedKey('asaas', currentEnv, 'api_key', e.target.value)}
                                        placeholder="Chave secreta..."
                                    />
                                    <Input
                                        label="Wallet ID (Opcional)"
                                        value={(localKeys as any).asaas?.[currentEnv]?.wallet_id || ''}
                                        onChange={(e) => updateNestedKey('asaas', currentEnv, 'wallet_id', e.target.value)}
                                        placeholder="Identificador da carteira..."
                                    />
                                </div>
                            )}

                            {appSettings?.platform_billing_provider === 'stripe' && (
                                <div className="space-y-4">
                                    <Input
                                        label={`Public Key Stripe [${currentEnv.toUpperCase()}]`}
                                        value={(localKeys as any).stripe?.[currentEnv]?.publishable_key || ''}
                                        onChange={(e) => updateNestedKey('stripe', currentEnv, 'publishable_key', e.target.value)}
                                        placeholder="pk_..."
                                    />
                                    <Input
                                        label={`Secret Key Stripe [${currentEnv.toUpperCase()}]`}
                                        type="password"
                                        value={(localKeys as any).stripe?.[currentEnv]?.secret_key || ''}
                                        onChange={(e) => updateNestedKey('stripe', currentEnv, 'secret_key', e.target.value)}
                                        placeholder="sk_..."
                                    />
                                </div>
                            )}

                            {appSettings?.platform_billing_provider === 'mercadopago' && (
                                <div className="space-y-4">
                                    <Input
                                        label={`Public Key MP [${currentEnv.toUpperCase()}]`}
                                        value={(localKeys as any).mercadopago?.[currentEnv]?.public_key || ''}
                                        onChange={(e) => updateNestedKey('mercadopago', currentEnv, 'public_key', e.target.value)}
                                        placeholder="APP_USR-..."
                                    />
                                    <Input
                                        label={`Access Token MP [${currentEnv.toUpperCase()}]`}
                                        type="password"
                                        value={(localKeys as any).mercadopago?.[currentEnv]?.access_token || ''}
                                        onChange={(e) => updateNestedKey('mercadopago', currentEnv, 'access_token', e.target.value)}
                                        placeholder="APP_USR-..."
                                    />
                                </div>
                            )}

                            <div className="flex gap-2 mt-4">
                                <Button
                                    onClick={() => handleSaveSettings()}
                                    isLoading={saving}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
                                >
                                    <Save size={18} className="mr-2" />
                                    Salvar Alterações
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        setTesting(true);
                                        const provider = appSettings?.platform_billing_provider;
                                        const envConfig = (localKeys as any)[provider!]?.[currentEnv] || {};

                                        // Standardize keys for the backend adapter
                                        const config: any = {};
                                        if (provider === 'asaas') config.api_key = envConfig.api_key;
                                        else if (provider === 'stripe') config.api_key = envConfig.secret_key;
                                        else if (provider === 'mercadopago') config.access_token = envConfig.access_token;

                                        const res = await testPlatformConnection(
                                            provider as any,
                                            config,
                                            appSettings?.platform_billing_sandbox ?? true
                                        );
                                        setTesting(false);
                                        setTestResult(res);
                                        if (res.success) {
                                            notify('success', 'Conexão validada com sucesso!', 'Gateway Online');
                                        } else {
                                            notify('error', res.message || 'Falha na conexão.', 'Erro de Credenciais');
                                        }
                                    }}
                                    isLoading={testing}
                                    className="px-3"
                                    title="Testar Conexão"
                                >
                                    <Activity size={18} className={testing ? 'animate-pulse' : ''} />
                                </Button>
                            </div>

                            {testResult && (
                                <div className={`mt-3 p-3 rounded-xl border text-[10px] flex items-start gap-2 animate-in fade-in slide-in-from-top-1 ${testResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                    <div className={`mt-0.5 w-1.5 h-1.5 rounded-full ${testResult.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    <div>
                                        <strong>Status:</strong> {testResult.success ? 'Conectado com sucesso!' : 'Falha na autenticação.'}
                                        <p className="mt-1 opacity-80">{testResult.message}</p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-4">
                                <div className="flex items-center gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                                    <input
                                        type="checkbox"
                                        checked={appSettings?.billing_notifications_enabled}
                                        onChange={(e) => updateAppSettings({ billing_notifications_enabled: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Ativar réguas de cobrança (CRON)</span>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Template WhatsApp</label>
                                            <button
                                                type="button"
                                                onClick={() => handleMagicTemplate('whatsapp')}
                                                disabled={isGeneratingWhatsApp}
                                                className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                                title="Gerar com IA"
                                            >
                                                {isGeneratingWhatsApp ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            </button>
                                        </div>
                                        <textarea
                                            value={appSettings?.billing_whatsapp_template || ''}
                                            onChange={(e) => updateAppSettings({ billing_whatsapp_template: e.target.value })}
                                            className="w-full text-[11px] p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl min-h-[80px] outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Ex: Olá, {company_name}! Sua fatura vence em {due_date}..."
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Template E-mail (HTML)</label>
                                            <button
                                                type="button"
                                                onClick={() => handleMagicTemplate('email')}
                                                disabled={isGeneratingEmail}
                                                className="text-blue-600 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                                title="Gerar com IA"
                                            >
                                                {isGeneratingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                            </button>
                                        </div>
                                        <textarea
                                            value={appSettings?.billing_email_template || ''}
                                            onChange={(e) => updateAppSettings({ billing_email_template: e.target.value })}
                                            className="w-full text-[11px] p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl min-h-[80px] outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Ex: <h1>Sua Fatura</h1>..."
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                    <div className="text-[9px] text-amber-800 dark:text-amber-200 leading-relaxed italic">
                                        <strong>Variáveis aceitas:</strong> {'{company_name}'}, {'{due_date}'}, {'{days}'}, {'{value}'}, {'{payment_link}'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Subscribers List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Users className="text-emerald-500" size={20} />
                                Associados do Sistema
                                <button
                                    onClick={() => refresh()}
                                    disabled={adminLoading}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    title="Atualizar Dados"
                                >
                                    <RefreshCw size={14} className={adminLoading ? 'animate-spin' : ''} />
                                </button>
                            </h3>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar associado..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full md:w-48"
                                    />
                                </div>
                                <select
                                    className="bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value as any)}
                                >
                                    <option value="all">Todos</option>
                                    <option value="active">Pagantes</option>
                                    <option value="trial">Em Teste</option>
                                    <option value="past_due">Atrasados</option>
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-100 dark:border-slate-700">
                                    <tr>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-[10px] uppercase">Empresa / Dono</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-[10px] uppercase text-center">Plano</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-[10px] uppercase text-center">Status</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-[10px] uppercase text-center">Valor</th>
                                        <th className="px-4 py-3 font-bold text-gray-500 text-[10px] uppercase text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                    {filteredCompanies.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500 animate-pulse">
                                                Nenhum associado encontrado para este filtro.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCompanies.map((c, idx) => (
                                            <tr
                                                key={c.id}
                                                style={{ animationDelay: `${idx * 50}ms` }}
                                                className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors animate-in fade-in slide-in-from-left-2 duration-300"
                                            >
                                                <td className="px-4 py-4">
                                                    <div className="font-bold text-gray-900 dark:text-white leading-tight">{c.trade_name}</div>
                                                    <div className="text-[10px] text-gray-500">{c.owner_name}</div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.subscription_plan === 'trial' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        {c.subscription_plan?.toUpperCase() || 'PADRÃO'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.subscription_status === 'active' ? 'bg-green-50 text-green-600' :
                                                            c.subscription_status === 'past_due' ? 'bg-red-50 text-red-600' :
                                                                'bg-gray-50 text-gray-600'
                                                            }`}>
                                                            {c.subscription_status?.toUpperCase() || 'Pendente'}
                                                        </span>
                                                        {c.status === 'blocked' && (
                                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-600 text-white uppercase animate-pulse">
                                                                Bloqueada
                                                            </span>
                                                        )}
                                                        {c.trial_ends_at && c.subscription_plan === 'trial' && (
                                                            <span className="text-[9px] text-gray-400">Expira {new Date(c.trial_ends_at).toLocaleDateString()}</span>
                                                        )}
                                                        {c.current_period_end && c.subscription_plan !== 'trial' && (
                                                            <span className="text-[9px] text-blue-500 font-medium">Vence {new Date(c.current_period_end).toLocaleDateString()}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center font-bold text-gray-900 dark:text-white">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.next_billing_value || 97)}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {c.subscription_status !== 'active' && (
                                                            <button
                                                                onClick={() => manualRenewSubscription(c.id)}
                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-100"
                                                                title={t('lead_radar.manual_renew')}
                                                            >
                                                                <CheckCircle size={14} />
                                                                <span className="text-[10px] font-bold uppercase">Renovar</span>
                                                            </button>
                                                        )}
                                                        {c.subscription_plan !== 'trial' && (
                                                            <button
                                                                onClick={() => setCompanyTrial(c.id)}
                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-100"
                                                                title={t('lead_radar.set_trial')}
                                                            >
                                                                <ZapIcon size={14} />
                                                                <span className="text-[10px] font-bold uppercase">Trial</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleViewHistory(c.id, c.trade_name)}
                                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100"
                                                            title="Ver Histórico de Cobranças"
                                                        >
                                                            <CreditCard size={14} />
                                                            <span className="text-[10px] font-bold uppercase">Histórico</span>
                                                        </button>
                                                        <label className="relative inline-flex items-center cursor-pointer scale-75">
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only peer"
                                                                checked={c.status !== 'blocked'}
                                                                onChange={() => toggleCompanyBlock(c.id, c.status !== 'blocked')}
                                                            />
                                                            <div className="w-11 h-6 bg-red-500 peer-focus:outline-none rounded-full peer dark:bg-red-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                                                        </label>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Billing History Modal */}
            {historyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/80">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CreditCard className="text-blue-500" />
                                    Histórico de Cobranças
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Pagamentos de: <span className="font-semibold text-gray-700 dark:text-gray-300">{selectedCompanyName}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setHistoryModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-full transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                                    <p className="text-gray-500">Buscando faturas...</p>
                                </div>
                            ) : billingHistory.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                        <Calendar className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Nenhum pagamento encontrado</h4>
                                    <p className="text-sm text-gray-500 max-w-sm mt-2">Esta empresa ainda não possui registros de pagamento em seu histórico.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {billingHistory.map((charge) => (
                                        <div key={charge.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition-shadow">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wide
                                                            ${charge.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                            charge.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}
                                                        >
                                                            {charge.status === 'paid' ? 'Pago' : charge.status === 'pending' ? 'Pendente' : charge.status}
                                                        </span>
                                                        <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.amount || 0)}
                                                        </span>
                                                    </div>
                                                    
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{charge.description}</p>
                                                    
                                                    <div className="flex mt-3 gap-4 text-xs text-gray-500">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar size={14} className="text-gray-400" />
                                                            {new Date(charge.created_at).toLocaleDateString()}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Activity size={14} className="text-gray-400" />
                                                            {charge.provider?.toUpperCase()} - {charge.payment_method?.toUpperCase()}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {charge.payment_link && charge.status !== 'paid' && (
                                                    <a 
                                                        href={charge.payment_link} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-lg text-sm font-semibold transition-colors w-full sm:w-auto mt-2 sm:mt-0"
                                                    >
                                                        Link de Pagamento
                                                        <ExternalLink size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
