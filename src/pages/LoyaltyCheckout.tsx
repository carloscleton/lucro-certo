import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CreditCard, Rocket, ShieldCheck, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function LoyaltyCheckout() {
    const { planId } = useParams<{ planId: string }>();
    const navigate = useNavigate();
    
    // States
    const [plan, setPlan] = useState<any>(null);
    const [company, setCompany] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Form
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerDocument, setCustomerDocument] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');

    useEffect(() => {
        async function loadPlanData() {
            if (!planId) return;
            try {
                // Fetch Plan + Company + Loyalty Settings
                const { data: planData, error: planError } = await supabase
                    .from('loyalty_plans')
                    .select('*, company:companies(id, trade_name, logo_url, slug)')
                    .eq('id', planId)
                    .single();

                if (planError || !planData) throw new Error('Plano não encontrado.');
                setPlan(planData);
                setCompany(planData.company);

                const { data: settingsData } = await supabase
                    .from('loyalty_settings')
                    .select('*')
                    .eq('company_id', planData.company.id)
                    .single();
                
                setSettings(settingsData);

            } catch (err: any) {
                console.error('Checkout Load Error:', err);
                setError(err.message || 'Erro ao carregar o plano.');
            } finally {
                setLoading(false);
            }
        }

        loadPlanData();
    }, [planId]);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!plan || !settings) return;
        
        setProcessing(true);
        setError(null);

        try {
            // 1. Create Subscription via Edge Function (to handle gateway sync)
            const { data, error } = await supabase.functions.invoke('loyalty-checkout', {
                body: {
                    planId,
                    customer: {
                        name: customerName,
                        phone: customerPhone,
                        document: customerDocument,
                        email: customerEmail
                    }
                }
            });

            if (data?.success) {
                // If it's a redirect to gateway
                if (data.checkout_url) {
                    window.location.href = data.checkout_url;
                } else {
                    setSuccess(true);
                }
            } else {
                throw new Error(data?.error || error?.message || 'Falha ao processar assinatura.');
            }
        } catch (err: any) {
            console.error('Subscription Error:', err);
            setError(err.response?.data?.error || err.message || 'Erro ao processar sua assinatura.');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" strokeWidth={3} />
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] p-12 text-center shadow-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-8">
                        <CheckCircle2 size={56} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tighter italic">Assinatura Realizada!</h2>
                    <p className="text-slate-500 mb-10 leading-relaxed font-medium">Parabéns! Você agora é um membro VIP. Verifique seu e-mail e WhatsApp para instruções de cobrança.</p>
                    <button 
                        onClick={() => navigate(`/clube/${company?.slug}`)} 
                        className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-transform"
                    >
                        Voltar ao Clube
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row">
            {/* Sidebar - Plan Summary */}
            <div className="md:w-[40%] bg-slate-900 text-white p-12 md:p-20 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-20 opacity-10 blur-xl">
                    <CreditCard size={300} />
                </div>
                
                <div className="relative z-10">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="flex items-center gap-2 text-slate-400 hover:text-white mb-12 transition-colors font-bold uppercase text-[10px] tracking-widest"
                    >
                        <ArrowLeft size={16} />
                        Voltar
                    </button>

                    <div className="flex items-center gap-4 mb-20">
                        {company?.logo_url ? (
                            <img src={company.logo_url} alt={company.trade_name} className="h-10 w-auto invert brightness-0" />
                        ) : (
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white font-black">
                                {company?.trade_name.charAt(0)}
                            </div>
                        )}
                        <span className="font-black italic uppercase tracking-tighter">{company?.trade_name}</span>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-amber-500 uppercase tracking-[0.3em]">Você escolheu o plano</h3>
                        <h1 className="text-5xl font-black tracking-tighter italic uppercase leading-none">{plan?.name}</h1>
                        <p className="text-slate-400 font-medium text-lg leading-relaxed max-w-sm">
                            {plan?.description || 'Acesso completo a todos os benefícios de fidelidade.'}
                        </p>
                    </div>
                </div>

                <div className="relative z-10 pt-12 mt-12 border-t border-white/10">
                    <div className="flex justify-between items-baseline">
                        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Total do Investimento</span>
                        <div className="text-right">
                             <div className="text-4xl font-black italic tracking-tighter">
                                {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(plan?.price)}
                             </div>
                             <p className="text-slate-500 font-bold text-[10px] uppercase">Por mês • Sem fidelidade</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Section - Form */}
            <div className="flex-1 bg-white dark:bg-slate-950 p-12 md:p-20 overflow-y-auto">
                <div className="max-w-xl mx-auto">
                    <div className="mb-12">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter italic">Finalizar Assinatura</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Preencha seus dados para ativar o plano e gerar sua primeira cobrança.</p>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 text-sm font-bold mb-8">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubscribe} className="space-y-6">
                        <Input
                             label="Nome Completo *"
                             value={customerName}
                             onChange={e => setCustomerName(e.target.value)}
                             placeholder="Ex: Carlos Alberto"
                             required
                             className="h-14 rounded-2xl border-2"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                label="WhatsApp *"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="(00) 0 0000-0000"
                                required
                                className="h-14 rounded-2xl border-2"
                            />
                            <Input
                                label="CPF / CNPJ *"
                                value={customerDocument}
                                onChange={e => setCustomerDocument(e.target.value)}
                                placeholder="000.000.000-00"
                                required
                                className="h-14 rounded-2xl border-2"
                            />
                        </div>

                        <Input
                            label="E-mail principal *"
                            type="email"
                            value={customerEmail}
                            onChange={e => setCustomerEmail(e.target.value)}
                            placeholder="exemplo@gmail.com"
                            required
                            className="h-14 rounded-2xl border-2"
                        />

                        <div className="py-8 border-t border-slate-100 dark:border-slate-800">
                             <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/40 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 mb-8">
                                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-xl text-emerald-600">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Ambiente 100% Seguro</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Seus dados estão protegidos por criptografia de ponta a ponta.</p>
                                </div>
                             </div>

                             <Button 
                                type="submit" 
                                isLoading={processing}
                                className="w-full py-8 bg-amber-600 hover:bg-amber-700 text-white rounded-[2rem] text-2xl font-black uppercase tracking-widest italic shadow-3xl shadow-amber-500/30 active:scale-95 transition-all"
                             >
                                <span className="flex items-center justify-center gap-4">
                                    Assinar Agora
                                    <Rocket size={24} />
                                </span>
                             </Button>

                             <p className="mt-8 text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
                                Ao assinar, você concorda com nossos termos e políticas de cancelamento.
                             </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
