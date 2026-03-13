import { useState } from 'react';
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
    Ban,
    Zap as ZapIcon,
    Wand2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Input } from '../ui/Input';
import { useTranslation } from 'react-i18next';
import { useAdmin } from '../../hooks/useAdmin';
import { AdminBICharts } from './AdminBICharts';

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
                updateAppSettings({ [type === 'whatsapp' ? 'billing_whatsapp_template' : 'billing_email_template']: data.text });
            }
        } catch (error) {
            console.error('Magic error:', error);
        } finally {
            setGenerating(false);
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
                                                        {c.trial_ends_at && c.subscription_plan === 'trial' && (
                                                            <span className="text-[9px] text-gray-400">Expira {new Date(c.trial_ends_at).toLocaleDateString()}</span>
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
                                                            onClick={() => toggleCompanyBlock(c.id, c.status !== 'blocked')}
                                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors border ${c.status === 'blocked'
                                                                ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-100'
                                                                : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-100'
                                                                }`}
                                                            title={c.status === 'blocked' ? t('lead_radar.unblock') : t('lead_radar.block')}
                                                        >
                                                            <Ban size={14} />
                                                            <span className="text-[10px] font-bold uppercase">
                                                                {c.status === 'blocked' ? 'Liberar' : 'Bloquear'}
                                                            </span>
                                                        </button>
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
        </div>
    );
}
