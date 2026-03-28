import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useEntity } from '../../context/EntityContext';
import { format } from 'date-fns';
import { User, CreditCard, ChevronRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function SubscriberList() {
    const { t } = useTranslation();
    const { currentEntity } = useEntity();
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSubscribers() {
            if (!currentEntity.id) return;
            try {
                const { data, error } = await supabase
                    .from('loyalty_subscriptions')
                    .select(`
                        *,
                        plan:loyalty_plans(name),
                        contact:contacts(name, phone, email)
                    `)
                    .eq('company_id', currentEntity.id)
                    .order('created_at', { ascending: false });

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

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-500" /></div>;

    const stats = {
        total: subscribers.length,
        active: subscribers.filter(s => s.status === 'active').length,
        past_due: subscribers.filter(s => s.status === 'past_due').length,
        cancelled: subscribers.filter(s => s.status === 'cancelled').length
    };

    const percentages = {
        active: (stats.active / stats.total) * 100,
        past_due: (stats.past_due / stats.total) * 100,
        cancelled: (stats.cancelled / stats.total) * 100
    };

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
        <div className="space-y-8">
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
                <div className="h-2 w-full flex rounded-full overflow-hidden bg-gray-100 dark:bg-slate-700 shadow-inner">
                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${percentages.active}%` }} />
                    <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${percentages.past_due}%` }} />
                    <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${percentages.cancelled}%` }} />
                </div>
            </div>

            {/* Subscriber Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subscribers.map((sub) => (
                    <div key={sub.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all flex flex-col gap-4 group relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-1 h-full ${
                            sub.status === 'active' ? 'bg-emerald-500' : 
                            sub.status === 'past_due' ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                        
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-500 font-bold text-sm">
                                {sub.contact?.name?.[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-gray-900 dark:text-white truncate">
                                    {sub.contact?.name}
                                </h4>
                                <p className="text-[10px] text-gray-500 truncate">{sub.contact?.email}</p>
                            </div>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest shrink-0 ${
                                sub.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 
                                sub.status === 'past_due' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                            }`}>
                                {sub.status === 'active' ? 'Ativo' : 
                                sub.status === 'past_due' ? 'Atraso' : 'Cancel'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-gray-50 dark:border-slate-700/50 pt-4">
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Plano</p>
                                <p className="font-bold text-xs text-gray-700 dark:text-gray-300 truncate">{sub.plan?.name}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Prox. Cobrança</p>
                                <p className={`font-bold text-xs ${sub.status === 'past_due' ? 'text-red-500' : 'text-amber-600'}`}>
                                    {sub.next_due_at ? format(new Date(sub.next_due_at), 'dd/MM') : '--/--'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                            <p className="text-[8px] text-gray-400">Desde {format(new Date(sub.created_at), 'dd/MM/yyyy')}</p>
                            <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                                Detalhes <ChevronRight size={12} />
                            </button>
                        </div>
                    </div>
                ))}
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
