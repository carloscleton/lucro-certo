import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useEntity } from '../../context/EntityContext';
import { format } from 'date-fns';
import { User, Calendar, CreditCard, ChevronRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
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
        <div className="grid grid-cols-1 gap-4">
            {subscribers.map((sub) => (
                <div key={sub.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 hover:shadow-lg transition-all flex flex-col md:flex-row items-center justify-between gap-6 group">
                   <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-500 font-bold">
                            {sub.contact?.name?.[0]}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                {sub.contact?.name}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                                    sub.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 
                                    sub.status === 'past_due' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                                }`}>
                                    {sub.status === 'active' ? t('loyalty.status_active', 'Ativo') : 
                                    sub.status === 'past_due' ? t('loyalty.status_overdue', 'Em Atraso') : t('loyalty.status_cancelled', 'Cancelado')}
                                </span>
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{sub.contact?.email} • {sub.contact?.phone}</p>
                        </div>
                   </div>

                   <div className="flex flex-wrap items-center gap-8 text-sm">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <CreditCard size={10} /> Plano
                            </p>
                            <p className="font-bold text-gray-700 dark:text-gray-300">{sub.plan?.name}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Calendar size={10} /> {t('loyalty.billing', 'Assinatura')}
                            </p>
                            <p className="font-bold text-gray-700 dark:text-gray-300">{format(new Date(sub.created_at), 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Clock size={10} /> {t('loyalty.next_billing', 'Próx. Cobrança')}
                            </p>
                            <p className="font-bold text-amber-600 dark:text-amber-400">
                                {sub.next_billing_date ? format(new Date(sub.next_billing_date), 'dd/MM/yyyy') : '--/--/----'}
                            </p>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all">
                            <ChevronRight size={20} />
                        </button>
                   </div>
                </div>
            ))}
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
