import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { Button } from '../components/ui/Button';
import { CreditCard, AlertTriangle, Check, Sparkles, Building2 } from 'lucide-react';
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
        <div className="min-h-screen bg-[#070b14] text-white selection:bg-blue-500/30 overflow-x-hidden font-sans">
            {/* Background Image - Enhanced Visibility */}
            <div className="fixed inset-0 z-0">
                <img 
                    src="/assets/premium_bg.png" 
                    alt="" 
                    className="w-full h-full object-cover opacity-[0.45] scale-105 blur-[1px]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/80 via-[#070b14]/90 to-[#070b14]" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-10 lg:py-14">
                {/* Header */}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-[0.2em] mb-4">
                        <Sparkles size={12} />
                        Plataforma Lucro Certo
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black mb-3 tracking-tight leading-tight">
                        {currentEntity?.subscription_plan === 'trial' ? 'Acelere sua Gestão agora.' : 'Ative sua conta Premium.'}
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto font-medium opacity-80">
                        Escolha seu plano e libere o poder completo do seu sistema financeiro.
                    </p>
                </div>

                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
                    {/* Plans Grid (Left) */}
                    <div className="w-full lg:col-span-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                            {plans.map((plan: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedPlan(plan)}
                                    className={`relative cursor-pointer rounded-[1.5rem] p-6 border transition-all duration-300 flex flex-col group ${
                                        selectedPlan?.name === plan.name 
                                            ? 'bg-blue-600/15 border-blue-500 shadow-[0_15px_30px_-10px_rgba(59,130,246,0.3)] ring-1 ring-blue-500/30' 
                                            : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    {plan.is_popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                                            Popular
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <h3 className="text-lg font-bold text-white mb-1 tracking-tight">{plan.name}</h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-white">R$ {plan.price}</span>
                                            <span className="text-slate-500 text-[10px] uppercase">/{plan.period === 'mensal' ? 'mês' : plan.period}</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 mb-8">
                                        {plan.features?.map((feat: string, fIdx: number) => (
                                            <div key={fIdx} className="flex items-start gap-2">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 border border-emerald-500/20">
                                                    <Check size={12} className="text-emerald-500" />
                                                </div>
                                                <span className="text-slate-400 text-[13px] leading-snug">{feat.replace(/\*\*/g, '')}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 text-center ${
                                        selectedPlan?.name === plan.name 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-white/10 text-slate-300 group-hover:bg-white/20'
                                    }`}>
                                        {selectedPlan?.name === plan.name ? 'Selecionado' : 'Selecionar'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Billing Sidebar (Right) */}
                    <div className="w-full lg:col-span-4 lg:sticky lg:top-24">
                        <div className="bg-white/[0.04] backdrop-blur-3xl rounded-[2rem] border border-white/15 p-8 shadow-2xl relative overflow-hidden group">
                            {/* Inner Glow */}
                            <div className="absolute -top-12 -right-12 w-24 h-24 bg-blue-600/10 rounded-full blur-2xl group-hover:bg-blue-600/20 transition-all" />
                            
                            <div className="flex items-center gap-3 mb-8 relative z-10">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner">
                                    <Building2 size={20} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-widest">Finalizar</h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Dados de Faturamento</p>
                                </div>
                            </div>
                            
                            <div className="space-y-5 mb-8 relative z-10">
                                <div className="space-y-1.5">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento (CPF/CNPJ)</label>
                                    <input
                                        type="text"
                                        value={documentStr}
                                        onChange={(e) => { setDocumentStr(formatDocument(e.target.value)); setErrorMsg(''); }}
                                        placeholder="000.000.000-00"
                                        className={`w-full bg-[#0a0f1a]/80 border ${errorMsg ? 'border-red-500/40' : 'border-white/10'} rounded-xl p-3.5 text-white placeholder:text-slate-800 focus:border-blue-500/40 transition-all outline-none text-sm font-medium shadow-inner`}
                                    />
                                    {errorMsg && <p className="text-red-500 text-[9px] font-bold uppercase tracking-tight ml-1">{errorMsg}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                                    <input
                                        type="text"
                                        value={phoneStr}
                                        onChange={(e) => { setPhoneStr(formatPhone(e.target.value)); setPhoneError(''); }}
                                        placeholder="+55 (00) 0000 0000"
                                        className={`w-full bg-[#0a0f1a]/80 border ${phoneError ? 'border-red-500/40' : 'border-white/10'} rounded-xl p-3.5 text-white placeholder:text-slate-800 focus:border-blue-500/40 transition-all outline-none text-sm font-medium shadow-inner`}
                                    />
                                    {phoneError && <p className="text-red-500 text-[9px] font-bold uppercase tracking-tight ml-1">{phoneError}</p>}
                                </div>
                            </div>

                            <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/5 relative z-10">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Plano</span>
                                    <span className="text-[10px] text-white font-black">{selectedPlan?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-black text-white tracking-tight">Total</span>
                                    <span className="text-xl font-black text-emerald-400">R$ {selectedPlan?.price || '0'}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handlePayment}
                                isLoading={loading}
                                className="w-full h-16 rounded-2xl text-base font-black bg-gradient-to-r from-blue-600 to-emerald-600 hover:scale-[1.02] shadow-xl shadow-blue-500/15 transition-all duration-300 flex items-center justify-center gap-3 group relative z-10"
                            >
                                <CreditCard size={18} className="group-hover:scale-110 transition-transform" />
                                ASSINAR AGORA
                            </Button>

                            <div className="mt-8 flex flex-col items-center gap-4 pt-6 border-t border-white/10 relative z-10">
                                <div className="flex items-center gap-2 text-slate-600 text-[9px] font-bold uppercase tracking-widest">
                                    <AlertTriangle size={12} className="text-amber-500/50" />
                                    100% Seguro via Asaas®
                                </div>
                                <button
                                    onClick={async () => { await signOut(); navigate('/'); }}
                                    className="text-slate-700 hover:text-white transition-colors text-[9px] font-black uppercase tracking-[0.2em]"
                                >
                                    Sair da Conta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
