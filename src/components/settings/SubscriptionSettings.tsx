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
            loadData();
        } else {
            setLoading(false);
        }
    }, [currentEntity]);

    const loadData = async () => {
        console.log('Fetching subscription for:', currentEntity.id);
        setLoading(true);
        try {
            await fetchSubscription();
        } catch (err) {
            console.error('Error in loadData:', err);
        } finally {
            setLoading(false);
            console.log('Subscription load finished.');
        }
    };

    const fetchSubscription = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('companies')
                .select('subscription_plan, subscription_status, current_period_end, trial_ends_at, next_billing_value, cnpj')
                .eq('id', currentEntity.id)
                .single();

            if (fetchError) throw fetchError;
            if (data) setSubscription(data);
        } catch (error) {
            console.error('Error fetching subscription:', error);
        }
    };

    if (loading) return <div className="p-4">Carregando informações da assinatura...</div>;

    if (!currentEntity?.id) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
                <CreditCard className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assinatura Pessoal</h3>
                <p className="text-sm text-gray-500 max-w-sm mt-2">
                    As assinaturas e planos são gerenciados por empresa. Selecione uma empresa no menu lateral para ver os detalhes da assinatura.
                </p>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        O Lucro Certo é gratuito para uso pessoal! ✨
                    </p>
                </div>
            </div>
        );
    }

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
                    <div className="flex items-center gap-3">
                        {isPastDue ? (
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                <AlertTriangle size={24} />
                            </div>
                        ) : (
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                <CheckCircle size={24} />
                            </div>
                        )}
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                                {isPastDue ? 'Pagamento Pendente' : 'Assinatura Regular'}
                            </p>
                            <p className="text-xs text-gray-500">
                                {isPastDue ? 'Regularize para evitar suspensão' : 'Sua conta está em dia'}
                            </p>
                        </div>
                    </div>

                    {isPastDue ? (
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
                            onClick={async () => {
                                try {
                                    const res = await supabase.functions.invoke('platform-checkout', {
                                        body: { company_id: currentEntity.id }
                                    });
                                    if (res.error) throw res.error;
                                    if (res.data?.paymentUrl) {
                                        window.location.href = res.data.paymentUrl;
                                    } else {
                                        throw new Error('Falha ao gerar link. Contate o suporte.');
                                    }
                                } catch (err: any) {
                                    alert(err.message || 'Erro ao gerar pagamento.');
                                }
                            }}
                        >
                            <ExternalLink size={16} />
                            Regularizar Agora
                        </Button>
                    ) : (
                        <Button
                            className="w-full bg-gray-100 dark:bg-slate-700 text-gray-400 cursor-not-allowed"
                            disabled
                        >
                            Plano em dia
                        </Button>
                    )}
                </div>

                {/* Next Billing Card */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Próxima Renovação</span>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">
                                {getRemainingDays()} Dias restantes
                            </p>
                            <p className="text-xs text-gray-500">
                                {isTrial ? 'Fim do teste em:' : 'Próxima cobrança em:'} {(() => {
                                    const dateStr = isTrial ? subscription?.trial_ends_at : subscription?.current_period_end;
                                    if (!dateStr) return 'Não definida';
                                    const d = new Date(dateStr);
                                    return isNaN(d.getTime()) ? 'Data inválida' : d.toLocaleDateString('pt-BR');
                                })()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {isPastDue && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex gap-3 items-center">
                    <AlertTriangle className="text-red-500" size={20} />
                    <p className="text-sm text-red-700 dark:text-red-300">
                        <strong>Aviso:</strong> Identificamos uma pendência financeira. Regularize agora para garantir que suas automações e o Social Copilot não sejam interrompidos.
                    </p>
                </div>
            )}

            {/* Support Info */}
            <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ajuda e Suporte</span>
                <p className="text-xs text-gray-500">Precisa de ajuda com sua assinatura ou quer um plano personalizado?</p>

                <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <CheckCircle size={14} className="text-emerald-500" />
                        Acesso a todos os módulos (Financeiro, CRM, Marketing)
                    </li>
                    <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <CheckCircle size={14} className="text-emerald-500" />
                        Até 5 usuários na equipe
                    </li>
                    <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <CheckCircle size={14} className="text-emerald-500" />
                        Suporte via WhatsApp
                    </li>
                </ul>

                <div className="pt-2">
                    <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:underline">
                        Falar com Suporte
                        <ExternalLink size={12} />
                    </a>
                </div>
            </div>
        </div>
    );
}
