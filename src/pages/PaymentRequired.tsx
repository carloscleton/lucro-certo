import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { Button } from '../components/ui/Button';
import { CreditCard, AlertTriangle, LogOut, Check, Sparkles, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

export function PaymentRequired() {
    const { profile, signOut } = useAuth();
    const { currentEntity } = useEntity();
    const [loading, setLoading] = useState(false);
    const [appSettings, setAppSettings] = useState<any>(null);
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [documentStr, setDocumentStr] = useState('');
    const [phoneStr, setPhoneStr] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
            if (data) {
                setAppSettings(data);
                // Pré-selecionar o plano atual ou o primeiro visível
                const plans = data.landing_plans || [];
                const current = plans.find((p: any) => p.name === currentEntity?.subscription_plan && p.enabled !== false);
                setSelectedPlan(current || plans.find((p: any) => p.enabled !== false));
            }
        };
        fetchSettings();
    }, [currentEntity]);

    useEffect(() => {
        if (currentEntity) {
            if (!documentStr) {
                setDocumentStr(formatDocument((currentEntity as any).document || currentEntity.cnpj || ''));
            }
            if (!phoneStr) {
                setPhoneStr(formatPhone(currentEntity.phone || profile?.phone || ''));
            }
        }
    }, [currentEntity, profile]);

    const formatDocument = (v: string) => {
        if (!v) return '';
        const numbers = v.replace(/\D/g, '');
        if (numbers.length <= 11) {
            return numbers.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2');
        }
        return numbers.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})/, '$1-$2').substring(0, 18);
    };

    const formatPhone = (v: string) => {
        if (!v) return '';
        let numbers = v.replace(/\D/g, '');
        if (numbers.length > 0 && !numbers.startsWith('55') && numbers.length <= 11) {
            numbers = '55' + numbers;
        }
        if (numbers.startsWith('55')) {
            const country = numbers.substring(0, 2);
            const rest = numbers.substring(2);
            if (rest.length <= 10) {
                return `+${country} (${rest.substring(0, 2)})${rest.length > 2 ? ' ' + rest.substring(2, 6) : ''}${rest.length > 6 ? '-' + rest.substring(6, 10) : ''}`;
            }
            return `+${country} (${rest.substring(0, 2)})${rest.length > 2 ? ' ' + rest.substring(2, 7) : ''}${rest.length > 7 ? '-' + rest.substring(7, 11) : ''}`;
        }
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 14);
        }
        return numbers.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
    };

    const handlePayment = async () => {
        if (!selectedPlan) {
            alert('Por favor, selecione um plano.');
            return;
        }

        const cleanDoc = documentStr.replace(/\D/g, '');
        const cleanPhone = phoneStr.replace(/\D/g, '');

        if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
            setErrorMsg('Por favor, informe um CPF ou CNPJ válido.');
            return;
        }

        if (cleanPhone.length < 10) {
            setPhoneError('Informe um telefone válido com DDD.');
            return;
        }

        setLoading(true);
        try {
            // 1. Atualizar o plano e dados de faturamento na empresa
            const { error: updateError } = await supabase
                .from('companies')
                .update({ 
                    cnpj: cleanDoc,
                    phone: cleanPhone,
                    subscription_plan: selectedPlan.name
                })
                .eq('id', currentEntity.id);
            
            if (updateError) throw updateError;

            // 2. Chamar o Checkout
            const { data: { session } } = await supabase.auth.getSession();
            const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-checkout`;
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    company_id: currentEntity.id,
                    access_token: session?.access_token
                })
            });

            const data = await response.json();

            if (response.ok && data?.paymentUrl) {
                window.open(data.paymentUrl, '_blank');
            } else {
                alert(`Erro ao gerar pagamento: ${data?.error || "Tente novamente em instantes."}`);
            }
        } catch (err) {
            console.error("Erro no processo de pagamento:", err);
            alert("Erro ao conectar com o gateway. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    const plans = appSettings?.landing_plans?.filter((p: any) => p.enabled !== false) || [];

    return (
        <div className="fixed inset-0 bg-slate-900 z-[9999] overflow-y-auto pb-12">
            <div className="max-w-6xl mx-auto px-4 pt-12">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                        <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
                        {currentEntity?.subscription_plan === 'trial' ? 'Seu Teste Grátis Expirou ⏳' : 'Ative seu Lucro Certo ✨'}
                    </h1>
                    <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                        Escolha o plano ideal para o momento do seu negócio e continue transformando sua gestão financeira.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {plans.map((plan: any, idx: number) => (
                        <div 
                            key={idx}
                            onClick={() => setSelectedPlan(plan)}
                            className={`relative cursor-pointer rounded-3xl p-6 border-2 transition-all duration-300 flex flex-col ${
                                selectedPlan?.name === plan.name 
                                    ? 'bg-blue-600/5 border-blue-500 shadow-[0_20px_50px_-12px_rgba(59,130,246,0.3)]' 
                                    : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
                            }`}
                        >
                            {plan.is_popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                                    Mais Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-black text-white">R$ {plan.price}</span>
                                    <span className="text-slate-400 text-sm font-medium">/{plan.period}</span>
                                </div>
                                {plan.observation && <p className="text-blue-400 text-[11px] font-bold mt-2 uppercase tracking-wide">{plan.observation}</p>}
                            </div>

                            <div className="flex-1 space-y-3 mb-8">
                                {plan.features?.map((feat: string, fIdx: number) => (
                                    <div key={fIdx} className="flex items-start gap-2">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 border border-emerald-500/20">
                                            <Check size={12} className="text-emerald-500" />
                                        </div>
                                        <span className="text-slate-300 text-sm leading-tight">{feat.replace(/\*\*/g, '')}</span>
                                    </div>
                                ))}
                            </div>

                            <div className={`w-full py-3 rounded-xl font-bold text-center transition-all ${
                                selectedPlan?.name === plan.name 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-slate-700 text-slate-300'
                            }`}>
                                {selectedPlan?.name === plan.name ? 'Selecionado' : 'Selecionar'}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="max-w-2xl mx-auto">
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl border border-slate-700 p-8 shadow-2xl">
                        <h4 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Building2 className="text-blue-500" size={20} />
                            Dados de Faturamento
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">CPF ou CNPJ</label>
                                <input
                                    type="text"
                                    value={documentStr}
                                    onChange={(e) => { setDocumentStr(formatDocument(e.target.value)); setErrorMsg(''); }}
                                    placeholder="000.000.000-00"
                                    className={`w-full bg-slate-900 border ${errorMsg ? 'border-red-500' : 'border-slate-700'} rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none`}
                                />
                                {errorMsg && <p className="text-red-500 text-[10px] mt-2 font-bold">{errorMsg}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">WhatsApp</label>
                                <input
                                    type="text"
                                    value={phoneStr}
                                    onChange={(e) => { setPhoneStr(formatPhone(e.target.value)); setPhoneError(''); }}
                                    placeholder="+55 (00) 00000-0000"
                                    className={`w-full bg-slate-900 border ${phoneError ? 'border-red-500' : 'border-slate-700'} rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500/20 transition-all outline-none`}
                                />
                                {phoneError && <p className="text-red-500 text-[10px] mt-2 font-bold">{phoneError}</p>}
                            </div>
                        </div>

                        <Button
                            onClick={handlePayment}
                            isLoading={loading}
                            className="w-full h-16 rounded-2xl text-xl font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-3"
                        >
                            <CreditCard size={24} />
                            ASSINAR AGORA
                        </Button>

                        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-700/50">
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <AlertTriangle size={16} className="text-amber-500" />
                                Gateway de Pagamento 100% Seguro
                            </div>
                            <button
                                onClick={async () => { await signOut(); navigate('/'); }}
                                className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-sm font-bold"
                            >
                                <LogOut size={16} />
                                Sair da Conta
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
