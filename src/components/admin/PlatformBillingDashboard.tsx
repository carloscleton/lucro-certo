import { useState } from 'react';
import {
    Users,
    AlertTriangle,
    Clock,
    TrendingUp,
    Search,
    ArrowUpRight,
    DollarSign,
    RefreshCw
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAdmin } from '../../hooks/useAdmin';

export function PlatformBillingDashboard() {
    const {
        appSettings,
        updateAppSettings,
        companiesList,
        refresh,
        loading: adminLoading
    } = useAdmin();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'past_due' | 'trial'>('all');

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
                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <TrendingUp size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Receita Mensal Est.</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.estimatedRevenue)}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <ArrowUpRight size={14} />
                        <span>Baseado em assinantes Pro</span>
                    </div>
                </div>

                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Users size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Assinantes Pro</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalActive}</div>
                    <div className="mt-2 text-xs text-gray-500">Planos ativos e pagos</div>
                </div>

                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl">
                            <Clock size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Em Teste (Trial)</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalTrials}</div>
                    <div className="mt-2 text-xs text-gray-500">Aguardando conversão</div>
                </div>

                <div className="p-5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                            <AlertTriangle size={20} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pendentes/Atrasados</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPastDue}</div>
                    <div className="mt-2 text-xs text-red-500 font-medium">Requer atenção comercial</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gateway Config Section (Moved here) */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <DollarSign size={20} />
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Configuração de Pay</h3>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Provedor Ativo</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['asaas', 'stripe', 'mercadopago'].map((provider) => (
                                        <button
                                            key={provider}
                                            disabled={adminLoading}
                                            onClick={() => updateAppSettings({ platform_billing_provider: provider as any })}
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

                            {appSettings?.platform_billing_provider === 'asaas' && (
                                <Input
                                    label="API Key Asaas"
                                    type="password"
                                    value={appSettings?.platform_asaas_api_key || ''}
                                    onChange={(e) => updateAppSettings({ platform_asaas_api_key: e.target.value })}
                                    placeholder="Chave secreta..."
                                />
                            )}

                            {appSettings?.platform_billing_provider === 'stripe' && (
                                <Input
                                    label="API Key Stripe"
                                    type="password"
                                    value={appSettings?.platform_stripe_api_key || ''}
                                    onChange={(e) => updateAppSettings({ platform_stripe_api_key: e.target.value })}
                                    placeholder="sk_live_..."
                                />
                            )}

                            {appSettings?.platform_billing_provider === 'mercadopago' && (
                                <Input
                                    label="Access Token MP"
                                    type="password"
                                    value={appSettings?.platform_mercadopago_api_key || ''}
                                    onChange={(e) => updateAppSettings({ platform_mercadopago_api_key: e.target.value })}
                                    placeholder="APP_USR-..."
                                />
                            )}

                            <div className="pt-4 border-t border-gray-100 dark:border-slate-700 space-y-4">
                                <div className="flex items-center gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
                                    <input
                                        type="checkbox"
                                        checked={appSettings?.billing_notifications_enabled}
                                        onChange={(e) => updateAppSettings({ billing_notifications_enabled: e.target.checked })}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">Ativar réguas de cobrança</span>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-relaxed">
                                    As configurações de template de WhatsApp e E-mail permanecem no controle de sistema para segurança.
                                </p>
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
                                    {filteredCompanies.map((c) => (
                                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-gray-900 dark:text-white leading-tight">{c.trade_name}</div>
                                                <div className="text-[10px] text-gray-500">{c.owner_name}</div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.subscription_plan === 'trial' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {c.subscription_plan?.toUpperCase()}
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
                                                    {c.trial_ends_at && c.subscription_plan === 'trial' && (
                                                        <span className="text-[9px] text-gray-400">Expira {new Date(c.trial_ends_at).toLocaleDateString()}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center font-bold text-gray-900 dark:text-white">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.next_billing_value || 97)}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Ver Histórico">
                                                    <ArrowUpRight size={16} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
