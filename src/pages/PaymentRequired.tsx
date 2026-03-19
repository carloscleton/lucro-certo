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
                const current = plans.find((p: any) => p.name?.toLowerCase() === currentEntity?.subscription_plan?.toLowerCase() && p.enabled !== false);
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
        }        setLoading(true);
        try {
            let targetId = currentEntity.type === 'personal'
                ? (currentEntity.associated_company_id || profile?.company_id)
                : currentEntity.id;

            // ✅ AUTO-CRIAÇÃO: Se não existe empresa, cria uma PF na hora
            if (!targetId || targetId === 'personal') {
                const userName = profile?.full_name || 'Conta Pessoal';
                console.log('DEBUG: Criando PF para:', userName);
                const { data: createData, error: createError } = await supabase.rpc('create_company', {
                    name_input: userName,
                    trade_name_input: userName,
                    cnpj_input: '',
                    entity_type_input: 'PF',
                    cpf_input: null,
                    email_input: profile?.email || '',
                    phone_input: profile?.phone || '',
                });
                
                if (createError || !createData?.success) {
                    throw new Error(createData?.message || createError?.message || 'Erro ao criar conta.');
                }
                targetId = createData.company_id;
                console.log('DEBUG: Empresa PF criada! ID:', targetId);
            }

            // 1. Atualizar o plano e dados de faturamento na empresa
            const isCnpj = cleanDoc.length === 14;
            const { error: updateError } = await supabase
                .from('companies')
                .update({ 
                    [isCnpj ? 'cnpj' : 'cpf']: cleanDoc, // Use CPF column if it's 11 digits
                    phone: cleanPhone,
                    subscription_plan: selectedPlan.name
                })
                .eq('id', targetId);
            
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
                    company_id: targetId,
                    access_token: session?.access_token
                })
            });

            const data = await response.json();

            if (response.ok && data?.paymentUrl) {
                window.open(data.paymentUrl, '_blank');
            } else {
                alert(`Erro ao gerar pagamento: ${data?.error || "Tente novamente em instantes."}`);
            }
        } catch (err: any) {
            console.error("Erro no processo de pagamento:", err);
            alert("Erro ao processar: " + (err.message || "Verifique sua conexão."));
        } finally {
            setLoading(false);
        }
    };

    const plans = appSettings?.landing_plans?.filter((p: any) => p.enabled !== false) || [];

    return (
        <div className="min-h-screen bg-[#070b14] text-white selection:bg-blue-500/30">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px]" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 py-16 lg:py-24">
                {/* Hero Section with Image */}
                <div className="flex flex-col lg:flex-row items-center gap-16 mb-20">
                    <div className="flex-1 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-[0.2em] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <Sparkles size={14} />
                            Gestão de Alta Performance
                        </div>
                        <h1 className="text-4xl md:text-6xl font-black mb-8 leading-[1.1] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50">
                            {currentEntity?.subscription_plan === 'trial' ? 'Seu Período de Teste Expirou.' : 'Ative seu Lucro Certo Agora.'}
                        </h1>
                        <p className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-2xl">
                            Transforme sua gestão financeira com clareza, automação e inteligência. Escolha o plano que melhor se adapta ao momento da sua empresa.
                        </p>
                    </div>

                    <div className="flex-1 relative w-full max-w-lg lg:max-w-none">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
                            <div className="relative aspect-square md:aspect-video lg:aspect-square bg-slate-900 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
                                <img 
                                    src="file:///C:/Users/carlo/.gemini/antigravity/brain/757d300a-253e-4f79-b0a4-dd2440e46f26/premium_financial_growth_3d_1773953310925.png" 
                                    alt="Lucro Certo Premium Visualization" 
                                    className="w-full h-full object-cover transform scale-105 group-hover:scale-110 transition-transform duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Plan Selection Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                    {plans.map((plan: any, idx: number) => (
                        <div 
                            key={idx}
                            onClick={() => setSelectedPlan(plan)}
                            className={`relative cursor-pointer rounded-[2rem] p-8 border transition-all duration-500 flex flex-col group ${
                                selectedPlan?.name === plan.name 
                                    ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_20px_50px_-12px_rgba(59,130,246,0.5)] ring-1 ring-blue-500/20' 
                                    : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                            }`}
                        >
                            {plan.is_popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-400 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-lg">
                                    Mais Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">{plan.name}</h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-white">R$ {plan.price}</span>
                                    <span className="text-slate-500 text-sm font-medium uppercase tracking-widest">/{plan.period === 'mensal' ? 'mês' : plan.period}</span>
                                </div>
                                {plan.observation && <p className="text-blue-400 text-xs font-black mt-3 uppercase tracking-widest bg-blue-500/10 inline-block px-3 py-1 rounded-lg border border-blue-500/20">{plan.observation}</p>}
                            </div>

                            <div className="flex-1 space-y-4 mb-10">
                                {plan.features?.map((feat: string, fIdx: number) => (
                                    <div key={fIdx} className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 border border-emerald-500/20">
                                            <Check size={14} className="text-emerald-500" />
                                        </div>
                                        <span className="text-slate-400 text-sm leading-relaxed">{feat.replace(/\*\*/g, '')}</span>
                                    </div>
                                ))}
                            </div>

                            <div className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-300 ${
                                selectedPlan?.name === plan.name 
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                                    : 'bg-white/10 text-slate-300 group-hover:bg-white/20'
                            }`}>
                                {selectedPlan?.name === plan.name ? 'Plano Selecionado' : 'Selecionar'}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Billing Section */}
                <div className="max-w-3xl mx-auto">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-emerald-600/20 rounded-[2.5rem] blur-xl opacity-50" />
                        <div className="relative bg-white/[0.03] backdrop-blur-3xl rounded-[2.5rem] border border-white/10 p-10 md:p-12 shadow-2xl">
                            <h4 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                                    <Building2 size={24} />
                                </div>
                                Dados de Faturamento
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">CPF ou CNPJ</label>
                                    <input
                                        type="text"
                                        value={documentStr}
                                        onChange={(e) => { setDocumentStr(formatDocument(e.target.value)); setErrorMsg(''); }}
                                        placeholder="000.000.000-00"
                                        className={`w-full bg-[#0a0f1a] border ${errorMsg ? 'border-red-500/50' : 'border-white/10'} rounded-2xl p-4 text-white placeholder:text-slate-700 focus:border-blue-500/50 transition-all outline-none text-lg font-medium`}
                                    />
                                    {errorMsg && <p className="text-red-500 text-[10px] mt-2 font-black uppercase tracking-widest">{errorMsg}</p>}
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">WhatsApp</label>
                                    <input
                                        type="text"
                                        value={phoneStr}
                                        onChange={(e) => { setPhoneStr(formatPhone(e.target.value)); setPhoneError(''); }}
                                        placeholder="+55 (00) 00000-0000"
                                        className={`w-full bg-[#0a0f1a] border ${phoneError ? 'border-red-500/50' : 'border-white/10'} rounded-2xl p-4 text-white placeholder:text-slate-700 focus:border-blue-500/50 transition-all outline-none text-lg font-medium`}
                                    />
                                    {phoneError && <p className="text-red-500 text-[10px] mt-2 font-black uppercase tracking-widest">{phoneError}</p>}
                                </div>
                            </div>

                            <Button
                                onClick={handlePayment}
                                isLoading={loading}
                                className="w-full h-20 rounded-[1.5rem] text-xl font-black bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white shadow-2xl shadow-emerald-500/20 transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-4 group"
                            >
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <CreditCard size={24} />
                                </div>
                                ASSINAR AGORA
                            </Button>

                            <div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-white/5">
                                <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
                                    <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-500 border border-amber-500/20">
                                        <AlertTriangle size={16} />
                                    </div>
                                    Pagamento Seguro via Asaas®
                                </div>
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={async () => { await signOut(); navigate('/'); }}
                                        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                                    >
                                        <LogOut size={16} />
                                        Sair da Conta
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
