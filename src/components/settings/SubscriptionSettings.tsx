import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, AlertTriangle, Clock, ExternalLink, Building, X, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { useEntity } from '../../context/EntityContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export function SubscriptionSettings() {
    const { currentEntity } = useEntity();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    const [effectiveCompanyId, setEffectiveCompanyId] = useState<string | null>(null);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [availablePlans, setAvailablePlans] = useState<any[]>([]);
    const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);

    useEffect(() => {
        const resolveCompany = async () => {
            if (currentEntity?.id && currentEntity.id !== 'personal') {
                setEffectiveCompanyId(currentEntity.id);
            } else if (user?.id) {
                // If in personal, find the first company he's owner of
                const { data } = await supabase
                    .from('company_members')
                    .select('company_id')
                    .eq('user_id', user.id)
                    .eq('role', 'owner')
                    .limit(1)
                    .maybeSingle();
                
                if (data?.company_id) {
                    setEffectiveCompanyId(data.company_id);
                } else {
                    setLoading(false); // No company found
                }
            }
        };
        resolveCompany();
    }, [currentEntity, user]);

    useEffect(() => {
        if (effectiveCompanyId) {
            loadData();
        }
    }, [effectiveCompanyId]);

    const loadData = async () => {
        console.log('Fetching subscription and plans for:', effectiveCompanyId);
        setLoading(true);
        try {
            await Promise.all([
                fetchSubscription(),
                fetchAvailablePlans()
            ]);
        } catch (err) {
            console.error('Error in loadData:', err);
        } finally {
            setLoading(false);
            console.log('Subscription load finished.');
        }
    };

    const fetchAvailablePlans = async () => {
        try {
            const { data } = await supabase.from('app_settings').select('landing_plans').eq('id', 1).maybeSingle();
            if (data?.landing_plans) {
                setAvailablePlans(data.landing_plans.filter((p: any) => p.enabled !== false));
            }
        } catch (err) {
            console.error('Error fetching plans:', err);
        }
    };

    const fetchSubscription = async () => {
        try {
            const { data, error: fetchError } = await supabase
                .from('companies')
                .select('id, trade_name, subscription_plan, subscription_status, current_period_end, trial_ends_at, next_billing_value, cnpj')
                .eq('id', effectiveCompanyId)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (data) setSubscription(data);
        } catch (error) {
            console.error('Error fetching subscription:', error);
        }
    };

    const handleUpgradePlan = async (plan: any) => {
        setUpgradingPlan(plan.name);
        try {
            // 1. Prepare base update data
            const updateData: any = {
                subscription_plan: plan.name,
                next_billing_value: parseFloat(plan.price) || 0,
                subscription_status: 'unpaid' // Force checkout logic
            };

            // 2. Map plan modules to company columns
            if (plan.modules) {
                Object.keys(plan.modules).forEach(key => {
                    updateData[key] = plan.modules[key];
                });
            }

            // 3. Update company
            const { error: updateError } = await supabase
                .from('companies')
                .update(updateData)
                .eq('id', effectiveCompanyId);

            if (updateError) throw updateError;

            // 4. Invoke checkout
            const { data: { session: freshSession } } = await supabase.auth.getSession();
            const res = await supabase.functions.invoke('platform-checkout', {
                body: { 
                    company_id: effectiveCompanyId,
                    access_token: freshSession?.access_token 
                }
            });

            if (res.error) throw res.error;
            if (res.data?.paymentUrl) {
                // Open in new tab as requested
                window.open(res.data.paymentUrl, '_blank');
                setShowPlanModal(false);
                alert(`Plano ${plan.name} selecionado com sucesso! Já configuramos seus acessos conforme o plano. O link de pagamento foi aberto em uma nova aba.`);
            } else {
                throw new Error('Falha ao gerar link de pagamento. Contate o suporte.');
            }
        } catch (err: any) {
            alert(err.message || 'Erro ao processar alteração de plano.');
        } finally {
            setUpgradingPlan(null);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50/50 dark:bg-slate-900/10 rounded-2xl border border-gray-100 dark:border-slate-800">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-4"></div>
            <p className="text-sm text-gray-500 font-medium animate-pulse">Carregando informações da conta...</p>
        </div>
    );

    if (!effectiveCompanyId || !subscription) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
                <Building className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nenhuma Empresa Vinculada</h3>
                <p className="text-sm text-gray-500 max-w-sm mt-2">
                    Não encontramos uma assinatura vinculada diretamente ao seu perfil. 
                    Assinaturas são gerenciadas por empresas.
                </p>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        Deseja criar uma empresa? Vá ao menu lateral em "Empresas".
                    </p>
                </div>
            </div>
        );
    }

    const isTrial = subscription?.subscription_plan === 'trial';
    const isPastDue = subscription?.subscription_status === 'past_due';

    const getStatusColor = () => {
        if (isPastDue) return 'text-red-500 bg-red-50 border-red-100 dark:bg-red-900/20';
        if (isTrial) return 'text-blue-500 bg-blue-50 border-blue-100 dark:bg-blue-900/20';
        return 'text-emerald-500 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20';
    };

    const getRemainingDays = () => {
        const targetDate = isTrial ? subscription?.trial_ends_at : subscription?.current_period_end;
        if (!targetDate) return 0;
        const diff = new Date(targetDate).getTime() - new Date().getTime();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <CreditCard className="text-blue-600 mt-1" size={24} />
                <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">Assinatura do Plano</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {currentEntity.type === 'personal' 
                            ? `Gerenciando assinatura vinculada à: ${subscription.trade_name}`
                            : 'Gerencie seu plano do Lucro Certo e informações de faturamento.'}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Current Plan Card */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Configuração de Cobrança</span>
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
                            {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(subscription?.next_billing_value || 97)}
                        </span>
                        <span className="text-gray-500 text-sm">/mês</span>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                        <Button 
                            className="w-full" 
                            variant="outline"
                            onClick={() => setShowPlanModal(true)}
                        >
                            Alterar Plano
                        </Button>
                    </div>
                </div>

                {/* Status Card */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Situação da Conta</span>
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
                            <p className="font-bold text-gray-900 dark:text-white uppercase tracking-tight leading-tight">
                                {isPastDue ? 'Pagamento Ausente' : 'Pagamento em Dia'}
                            </p>
                            <p className="text-[10px] text-gray-500 leading-tight mt-1">
                                {isPastDue ? 'Regularize para evitar suspensão' : 'Sua licença está ativa e funcional'}
                            </p>
                        </div>
                    </div>

                    {isPastDue ? (
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
                            onClick={async () => {
                                try {
                                    const { data: { session: freshSession } } = await supabase.auth.getSession();
                                    const res = await supabase.functions.invoke('platform-checkout', {
                                        body: { 
                                            company_id: subscription.id,
                                            access_token: freshSession?.access_token 
                                        }
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
                            className="w-full bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed"
                            disabled
                        >
                            Plano em dia
                        </Button>
                    )}
                </div>

                {/* Next Billing Card */}
                <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tempo Restante</span>
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
                        <strong>Aviso:</strong> Identificamos uma pendência financeira na empresa <strong>{subscription.trade_name}</strong>. Regularize para garantir acesso total.
                    </p>
                </div>
            )}

            {/* Support Info */}
            <div className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ajuda e Suporte</span>
                <p className="text-xs text-gray-500">Precisa de ajuda com sua assinatura ou quer um plano personalizado?</p>

                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <CheckCircle size={14} className="text-emerald-500" />
                        Acesso a todos os módulos
                    </li>
                    <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <CheckCircle size={14} className="text-emerald-500" />
                        Até 5 usuários na equipe
                    </li>
                    <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <CheckCircle size={14} className="text-emerald-500" />
                        Automações Inteligentes
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
            {/* Plan Selection Modal */}
            {showPlanModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Escolha seu novo plano</h3>
                                <p className="text-sm text-gray-500">Selecione a melhor opção para a sua empresa</p>
                            </div>
                            <button 
                                onClick={() => setShowPlanModal(false)}
                                className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto">
                            {availablePlans.length > 0 ? (
                                availablePlans.map((plan: any, idx: number) => {
                                    const isCurrent = subscription?.subscription_plan === plan.name;
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`relative p-5 rounded-2xl border-2 transition-all flex flex-col ${
                                                isCurrent 
                                                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10' 
                                                    : plan.is_popular 
                                                        ? 'border-blue-500 bg-blue-50/10 dark:bg-blue-900/5 shadow-lg' 
                                                        : 'border-gray-100 dark:border-slate-800 hover:border-gray-300'
                                            }`}
                                        >
                                            {plan.is_popular && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                                                    <Sparkles size={10} /> RECOMENDADO
                                                </div>
                                            )}
                                            
                                            <div className="mb-4">
                                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h4>
                                                <p className="text-xs text-gray-500 mt-1 min-h-[2.5rem]">{plan.observation || 'Recursos avançados para sua gestão'}</p>
                                            </div>

                                            <div className="mb-6">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-gray-900 dark:text-white">R$ {plan.price}</span>
                                                    <span className="text-gray-400 text-[10px] font-bold uppercase">/{plan.period || 'mês'}</span>
                                                </div>
                                            </div>

                                            <ul className="space-y-2 mb-6 flex-1">
                                                {plan.features?.slice(0, 4).map((feat: string, fIdx: number) => (
                                                    <li key={fIdx} className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                                                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                                                        <span className="line-clamp-2">{feat.replace(/\*\*/g, '')}</span>
                                                    </li>
                                                ))}
                                            </ul>

                                            <Button 
                                                className="w-full" 
                                                variant={isCurrent ? "outline" : plan.is_popular ? "primary" : "outline"}
                                                disabled={isCurrent || upgradingPlan === plan.name}
                                                isLoading={upgradingPlan === plan.name}
                                                onClick={() => handleUpgradePlan(plan)}
                                            >
                                                {isCurrent ? 'Plano Atual' : (
                                                    <span className="flex items-center justify-center gap-2">
                                                        {plan.button_text || 'Selecionar'}
                                                        <ArrowRight size={14} />
                                                    </span>
                                                )}
                                            </Button>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-12 text-center text-gray-400">
                                    Nenhum plano disponível para contratação no momento.
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 bg-gray-50 dark:bg-slate-800/30 text-center border-t border-gray-100 dark:border-slate-800">
                            <p className="text-[10px] text-gray-400">
                                Ao mudar de plano, você será redirecionado para o checkout para processar o novo valor.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
