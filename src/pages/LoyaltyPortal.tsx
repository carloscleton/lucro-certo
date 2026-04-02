import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Award, CreditCard, CheckCircle2, Clock, XCircle, Package, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function LoyaltyPortal() {
    const { token } = useParams<{ token: string }>();
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    const [charges, setCharges] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadPortalData() {
            if (!token) return;
            try {
                // 1. Fetch Subscription by Portal Token
                const { data: sub, error: subError } = await supabase
                    .from('loyalty_subscriptions')
                    .select('*, plan:loyalty_plans(*), contact:contacts(*), company:companies(*)')
                    .eq('portal_token', token)
                    .single();

                if (subError || !sub) throw new Error('Acesso inválido ou expirado.');
                setSubscription(sub);

                // 2. Fetch recent charges
                const { data: chargesData } = await supabase
                    .from('loyalty_charges')
                    .select('*')
                    .eq('subscription_id', sub.id)
                    .order('created_at', { ascending: false });
                
                setCharges(chargesData || []);

            } catch (err: any) {
                console.error('Portal Error:', err);
                setError(err.message || 'Erro ao carregar o portal.');
            } finally {
                setLoading(false);
            }
        }
        loadPortalData();
    }, [token]);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
        </div>
    );

    if (error || !subscription) return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white dark:bg-slate-900 rounded-3xl p-10 border border-red-100 shadow-xl">
                <XCircle className="mx-auto text-red-500 mb-4" size={56} />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Ops! Acesso Negado</h2>
                <p className="text-slate-500">{error}</p>
            </div>
        </div>
    );

    const isPastDue = subscription.status === 'past_due';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        {subscription.company.logo_url ? (
                            <img src={subscription.company.logo_url} alt={subscription.company.trade_name} className="h-12 w-auto" />
                        ) : (
                            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white font-black text-xl">
                                {subscription.company.trade_name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-none uppercase italic tracking-tighter">
                                Portal do Assinante
                            </h1>
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
                                {subscription.company.trade_name}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Welcome Card */}
                    <div className="md:col-span-2 space-y-8">
                        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                             <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                                    <Award size={24} className="text-amber-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Olá, {subscription.contact.name.split(' ')[0]}!</h2>
                                    <p className="text-sm text-slate-500">Você é membro do plano <span className="text-amber-600 font-bold uppercase">{subscription.plan.name}</span></p>
                                </div>
                             </div>

                             <div className="grid grid-cols-2 gap-4 pt-8 border-t border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status da Assinatura</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${subscription.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className={`text-sm font-black uppercase tracking-widest ${subscription.status === 'active' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {subscription.status === 'active' ? 'Regular' : 'Inadimplente'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Próxima Cobrança</p>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {subscription.next_due_at ? format(new Date(subscription.next_due_at), 'dd/MM/yyyy') : '--/--/----'}
                                    </p>
                                </div>
                             </div>
                        </section>

                        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3 mb-8">
                                <Package className="text-amber-500" />
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic">Seus Benefícios</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                    <CheckCircle2 className="text-emerald-600" size={24} />
                                    <div>
                                        <p className="text-sm font-black text-emerald-900 dark:text-emerald-100 text-[10px] uppercase tracking-widest leading-none mb-1">Desconto Automático</p>
                                        <p className="text-lg font-black text-emerald-600 italic tracking-tighter">
                                            {subscription.plan.discount_percent}% OFF em Serviços
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <CheckCircle2 className="text-slate-400" size={20} />
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Atendimento Prioritário em Check-ins</p>
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <CheckCircle2 className="text-slate-400" size={20} />
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Suporte exclusivo via WhatsApp</p>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Quick Billing Card */}
                    <div className="space-y-8">
                        <section className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden ring-1 ring-white/10">
                            <CreditCard className="mb-6 opacity-20" size={40} />
                            <h3 className="text-xl font-black mb-4 italic uppercase tracking-tight">Pagamentos</h3>
                            
                            {isPastDue ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-red-500/20 rounded-2xl border border-red-500/30 text-red-100 text-xs font-bold flex items-center gap-2">
                                        <Clock size={16} />
                                        Cobrança pendente encontrada
                                    </div>
                                    <a href={charges[0]?.payment_link} target="_blank" rel="noreferrer" className="block">
                                        <button className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                                            Pagar Fatura
                                        </button>
                                    </a>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                     <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={32} />
                                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nada pendente</p>
                                </div>
                            )}
                        </section>

                        <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 shadow-xl border border-slate-100 dark:border-slate-800">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Histórico Recente</h3>
                            <div className="space-y-4">
                                {charges.slice(0, 3).map(charge => (
                                    <div key={charge.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tighter">
                                                {format(new Date(charge.created_at), 'MMM yyyy', { locale: ptBR })}
                                            </p>
                                            <p className="text-[10px] text-slate-400 uppercase font-black">
                                                {charge.status === 'paid' ? 'Pago' : 'Pendente'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black tabular-nums">
                                                {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(charge.amount)}
                                            </p>
                                            {charge.payment_link && (
                                                <a href={charge.payment_link} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 flex items-center gap-1 justify-end font-bold uppercase tracking-widest">
                                                    Recibo <ExternalLink size={8} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {charges.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Nenhum registro</p>}
                            </div>
                        </section>
                    </div>
                </div>

                <footer className="mt-20 text-center opacity-40">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                        Secure Access &bull; Managed by Lucro Certo
                    </p>
                </footer>
            </div>
        </div>
    );
}
