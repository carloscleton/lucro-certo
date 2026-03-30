import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useEntity } from '../../context/EntityContext';
import { format } from 'date-fns';
import { User, CreditCard, ChevronRight, CheckCircle2, Clock, XCircle, Search, Eye, EyeOff } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function SubscriberList() {
    const { t } = useTranslation();
    const { currentEntity } = useEntity();
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [platformFee, setPlatformFee] = useState(5);
    const [showFinancials, setShowFinancials] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSubscribers() {
            if (!currentEntity.id) return;
            try {
                const { data, error } = await supabase
                    .from('loyalty_subscriptions')
                    .select(`
                        *,
                        plan:loyalty_plans(name, price),
                        contact:contacts(name, phone, email)
                    `)
                    .eq('company_id', currentEntity.id)
                    .order('created_at', { ascending: false });

                const { data: settingsData } = await supabase
                    .from('loyalty_settings')
                    .select('platform_fee_percent')
                    .eq('company_id', currentEntity.id)
                    .single();

                if (settingsData) setPlatformFee(settingsData.platform_fee_percent);

                if (error) throw error;
                setSubscribers(data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchSubscribers();
    }, [currentEntity.id]);

    // Derives the real effective status based on next_due_at date, regardless of DB status
    const getEffectiveStatus = (sub: any): 'active' | 'past_due' | 'canceled' => {
        if (sub.status === 'canceled' || sub.status === 'cancelled') return 'canceled';
        if (sub.status === 'active' && sub.next_due_at) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            try {
                const dateOnly = sub.next_due_at.toString().split('T')[0];
                const dueDate = new Date(dateOnly + 'T00:00:00');
                if (!isNaN(dueDate.getTime()) && dueDate < today) return 'past_due';
            } catch (_) {}
        }
        if (sub.status === 'past_due') return 'past_due';
        return 'active';
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-500" /></div>;

    const stats = {
        total: subscribers.length,
        active: subscribers.filter(s => getEffectiveStatus(s) === 'active').length,
        past_due: subscribers.filter(s => getEffectiveStatus(s) === 'past_due').length,
        cancelled: subscribers.filter(s => getEffectiveStatus(s) === 'canceled').length
    };

    const percentages = {
        active: stats.total > 0 ? (stats.active / stats.total) * 100 : 0,
        past_due: stats.total > 0 ? (stats.past_due / stats.total) * 100 : 0,
        cancelled: stats.total > 0 ? (stats.cancelled / stats.total) * 100 : 0
    };

    const filteredSubscribers = subscribers.filter(sub => {
        const query = searchQuery.toLowerCase();
        return (
            sub.contact?.name?.toLowerCase().includes(query) ||
            sub.contact?.email?.toLowerCase().includes(query) ||
            sub.contact?.phone?.includes(query) ||
            sub.plan?.name?.toLowerCase().includes(query)
        );
    });

    if (subscribers.length === 0) {
        return (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700">
                <div className="w-16 h-16 bg-gray-50 dark:bg-slate-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('loyalty.no_subscribers', 'Nenhum assinante ainda')}</h3>
                <p className="text-gray-500 dark:text-gray-400">{t('loyalty.no_subscribers_desc', 'Quando os clientes assinarem via link público, eles aparecerão aqui.')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 p-4 rounded-2xl flex items-center gap-4">
                        <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 mb-0.5">Ativos</p>
                            <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none">{stats.active}</p>
                        </div>
                    </div>
                    
                    <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 p-4 rounded-2xl flex items-center gap-4">
                        <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/70 mb-0.5">Em Atraso</p>
                            <p className="text-2xl font-black text-amber-700 dark:text-amber-400 leading-none">{stats.past_due}</p>
                        </div>
                    </div>

                    <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 p-4 rounded-2xl flex items-center gap-4">
                        <div className="p-2.5 bg-red-100 text-red-600 rounded-xl">
                            <XCircle size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-600/70 mb-0.5">Cancelados</p>
                            <p className="text-2xl font-black text-red-700 dark:text-red-400 leading-none">{stats.cancelled}</p>
                        </div>
                    </div>
                </div>

                {/* Distribution Bar */}
                <div className="h-1.5 w-full flex rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700 shadow-inner">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${percentages.active}%` }} />
                    <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${percentages.past_due}%` }} />
                    <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${percentages.cancelled}%` }} />
                </div>
            </div>

            {/* Search and Privacy Toggle */}
            <div className="flex gap-4 items-center">
                <div className="relative group flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Pesquisar por nome, email, telefone ou plano..."
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowFinancials(!showFinancials)}
                    className={`p-3 rounded-2xl border transition-all flex items-center gap-2 font-bold text-xs ${
                        showFinancials 
                        ? 'bg-amber-50 border-amber-100 text-amber-600 hover:bg-amber-100' 
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                    title={showFinancials ? "Ocultar valores" : "Mostrar valores"}
                >
                    {showFinancials ? <Eye size={18} /> : <EyeOff size={18} />}
                    <span className="hidden sm:inline">{showFinancials ? 'Privacidade' : 'Ver Valores'}</span>
                </button>
            </div>

            {/* Subscriber Table */}
            <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 dark:bg-slate-900/40">
                        <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-700">
                            <th className="px-6 py-4">Assinante</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Valor</th>
                            <th className="px-6 py-4 text-center">Taxa ({platformFee}%)</th>
                            <th className="px-6 py-4 text-center">Lucro</th>
                            <th className="px-6 py-4">Plano</th>
                            <th className="px-6 py-4">Adesão</th>
                            <th className="px-6 py-4">Próx. Cobrança</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                        {filteredSubscribers.map((sub) => (
                            <tr key={sub.id} className="text-sm hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                                            {sub.contact?.name?.[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 dark:text-white truncate">{sub.contact?.name}</p>
                                            <p className="text-[10px] text-gray-500 truncate">{sub.contact?.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {(() => {
                                        const effectiveStatus = getEffectiveStatus(sub);
                                        return (
                                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                                                effectiveStatus === 'active' ? 'bg-emerald-100 text-emerald-600' : 
                                                effectiveStatus === 'past_due' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                                            }`}>
                                                {effectiveStatus === 'active' ? 'Ativo' : 
                                                effectiveStatus === 'past_due' ? 'Em Atraso' : 'Cancelado'}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        {showFinancials 
                                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sub.plan?.price || 0)
                                            : 'R$ ••••'}
                                    </p>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <p className="text-red-500 font-medium text-xs">
                                        {showFinancials 
                                            ? `-${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((sub.plan?.price || 0) * (platformFee / 100))}`
                                            : 'R$ ••'}
                                    </p>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <p className="font-black text-emerald-600 dark:text-emerald-400">
                                        {showFinancials 
                                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((sub.plan?.price || 0) * (1 - platformFee / 100))
                                            : 'R$ ••••'}
                                    </p>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="font-medium text-gray-700 dark:text-gray-300">{sub.plan?.name}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-gray-500 dark:text-gray-400 text-xs">{format(new Date(sub.created_at), 'dd/MM/yyyy')}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <p className={`font-bold text-xs ${
                                        getEffectiveStatus(sub) === 'past_due' 
                                            ? 'text-red-500' 
                                            : getEffectiveStatus(sub) === 'active' 
                                                ? 'text-amber-600' 
                                                : 'text-gray-400'
                                    }`}>
                                        {sub.next_due_at 
                                            ? (() => { 
                                                try { 
                                                    return format(new Date(sub.next_due_at.toString().split('T')[0] + 'T00:00:00'), 'dd/MM/yyyy'); 
                                                } catch(_) { 
                                                    return '--/--/----'; 
                                                } 
                                            })()
                                            : '--/--/----'}
                                    </p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">
                                        <ChevronRight size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredSubscribers.length === 0 && (
                    <div className="p-12 text-center text-gray-500 italic text-sm">
                        Nenhum resultado encontrado para "{searchQuery}"
                    </div>
                )}
            </div>
        </div>
    );
}

export function ChargeHistory() {
    const { t } = useTranslation();
    const { currentEntity } = useEntity();
    const [charges, setCharges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchCharges() {
            if (!currentEntity.id) return;
            try {
                const { data, error } = await supabase
                    .from('loyalty_charges')
                    .select(`
                        *,
                        subscription:loyalty_subscriptions(
                            contact:contacts(name)
                        )
                    `)
                    .eq('company_id', currentEntity.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setCharges(data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchCharges();
    }, [currentEntity.id]);

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-500" /></div>;

    if (charges.length === 0) {
        return (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700">
                <div className="w-16 h-16 bg-gray-50 dark:bg-slate-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('loyalty.no_charges', 'Nenhuma cobrança registrada')}</h3>
                <p className="text-gray-500 dark:text-gray-400">{t('loyalty.no_charges_desc', 'As cobranças de assinatura aparecerão aqui conforme forem geradas.')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
            <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-slate-900/40">
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        <th className="px-6 py-4">{t('loyalty.subscriber', 'Assinante')}</th>
                        <th className="px-6 py-4">{t('loyalty.amount', 'Valor')}</th>
                        <th className="px-6 py-4">{t('loyalty.date', 'Data')}</th>
                        <th className="px-6 py-4">{t('loyalty.status', 'Status')}</th>
                        <th className="px-6 py-4">{t('loyalty.payment_link', 'Link Pgmto')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {charges.map((charge) => (
                        <tr key={charge.id} className="text-sm hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4">
                                <p className="font-bold text-gray-900 dark:text-white whitespace-nowrap">
                                    {charge.subscription?.contact?.name || 'Cliente Removido'}
                                </p>
                            </td>
                            <td className="px-6 py-4">
                                <p className="font-black italic text-gray-900 dark:text-white">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.amount)}
                                </p>
                            </td>
                            <td className="px-6 py-4">
                                <p className="text-gray-500 dark:text-gray-400">
                                    {format(new Date(charge.created_at), 'dd/MM/yyyy')}
                                </p>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-2">
                                    {charge.status === 'paid' ? (
                                        <>
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                            <span className="text-[10px] font-black uppercase text-emerald-600">Pago</span>
                                        </>
                                    ) : charge.status === 'overdue' ? (
                                        <>
                                            <XCircle size={16} className="text-red-500" />
                                            <span className="text-[10px] font-black uppercase text-red-600">Atrasado</span>
                                        </>
                                    ) : (
                                        <>
                                            <Clock size={16} className="text-amber-500" />
                                            <span className="text-[10px] font-black uppercase text-amber-600">Pendente</span>
                                        </>
                                    )}
                               </div>
                            </td>
                            <td className="px-6 py-4">
                                {charge.payment_link && (
                                    <a href={charge.payment_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold text-xs">
                                        {t('loyalty.open_invoice', 'Abrir Fatura')}
                                    </a>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
