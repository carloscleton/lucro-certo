import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { useEntity } from '../../context/EntityContext';
import { supabase } from '../../lib/supabase';

export function SubscriptionSettings() {
    const { currentEntity } = useEntity();
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);

    useEffect(() => {
        if (currentEntity?.id) {
            fetchSubscription();
        }
    }, [currentEntity]);

    const fetchSubscription = async () => {
        setLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('companies')
                .select('subscription_plan, subscription_status, current_period_end, trial_ends_at, next_billing_value')
                .eq('id', currentEntity.id)
                .single();

            if (fetchError) throw fetchError;

            if (data) {
                setSubscription(data);
            }
        } catch (error) {
            console.error('Error fetching subscription:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-4">Carregando informações da assinatura...</div>;

    const isTrial = subscription?.subscription_plan === 'trial';
    const isPastDue = subscription?.subscription_status === 'past_due';

    const getStatusColor = () => {
        if (isPastDue) return 'text-red-500 bg-red-50 border-red-100';
        if (isTrial) return 'text-blue-500 bg-blue-50 border-blue-100';
        return 'text-green-500 bg-green-50 border-green-100';
    };

    const getRemainingDays = () => {
        const targetDate = isTrial ? subscription?.trial_ends_at : subscription?.current_period_end;
        if (!targetDate) return 0;
        const diff = new Date(targetDate).getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <CreditCard className="text-blue-600 mt-1" size={24} />
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Plano e Assinatura</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Gerencie seu plano do Lucro Certo e informações de faturamento.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Current Plan Card */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Seu Plano</span>
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                                {subscription?.subscription_plan === 'trial' ? 'Período de Teste' : subscription?.subscription_plan || 'Pro'}
                            </h4>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getStatusColor()}`}>
                            {subscription?.subscription_status?.toUpperCase() || 'ATIVO'}
                        </div>
                    </div>

                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subscription?.next_billing_value || 97)}
                        </span>
                        <span className="text-gray-500 text-sm">/mês</span>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                        <Button className="w-full" variant="outline">
                            Alterar Plano
                        </Button>
                    </div>
                </div>

                {/* Status Card */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status do Pagamento</span>

                    <div className="space-y-3">
                        {isTrial ? (
                            <div className="flex items-center gap-3 text-blue-600">
                                <Clock size={20} />
                                <div>
                                    <div className="font-bold">{getRemainingDays()} dias restantes</div>
                                    <div className="text-[10px] text-gray-500">Seu teste expira em {new Date(subscription?.trial_ends_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 text-green-600">
                                <CheckCircle size={20} />
                                <div>
                                    <div className="font-bold">Em dia</div>
                                    <div className="text-[10px] text-gray-500">Próximo vencimento: {new Date(subscription?.current_period_end).toLocaleDateString()}</div>
                                </div>
                            </div>
                        )}

                        {isPastDue && (
                            <div className="flex items-center gap-3 text-red-500 p-3 bg-red-50 rounded-lg">
                                <AlertTriangle size={20} />
                                <div className="text-xs font-medium">Pagamento atrasado. Regularize para evitar bloqueio.</div>
                            </div>
                        )}
                    </div>

                    <div className="pt-4">
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            Pagar Agora / Ver Fatura
                        </Button>
                    </div>
                </div>

                {/* Info Card */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ajuda e Suporte</span>
                    <p className="text-xs text-gray-500">Precisa de ajuda com sua assinatura ou quer um plano personalizado?</p>

                    <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <CheckCircle size={14} className="text-emerald-500" />
                            Acesso a todos os módulos
                        </li>
                        <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <CheckCircle size={14} className="text-emerald-500" />
                            Suporte prioritário via WhatsApp
                        </li>
                    </ul>

                    <div className="pt-2">
                        <a href="https://wa.me/5511999999999" target="_blank" className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                            Falar com Suporte
                            <ExternalLink size={12} />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
