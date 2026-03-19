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

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-4 lg:py-8">
                {/* Compact Header */}
                <div className="text-center mb-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest mb-3">
                        <Sparkles size={10} />
                        Plataforma Lucro Certo
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black mb-1.5 tracking-tighter leading-none">
                        {currentEntity?.subscription_plan === 'trial' ? 'Acelere sua Gestão agora.' : 'Ative sua conta Premium.'}
                    </h1>
                    <p className="text-slate-400 text-[11px] md:text-sm max-w-lg mx-auto font-medium opacity-70">
                        Escolha seu plano e libere o poder completo do seu sistema financeiro.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    {/* Plans Grid (Left - 7 cols) */}
                    <div className="md:col-span-7 lg:col-span-7 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {plans.map((plan: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedPlan(plan)}
                                    className={`relative cursor-pointer rounded-2xl p-4 border transition-all duration-300 flex flex-col group ${
                                        selectedPlan?.name === plan.name 
                                            ? 'bg-blue-600/10 border-blue-500 shadow-lg ring-1 ring-blue-500/20' 
                                            : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                                    }`}
                                >
                                    {plan.is_popular && (
                                        <div className="absolute -top-2.5 left-6 bg-blue-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-md">
                                            Popular
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <h3 className="text-sm font-bold text-white mb-0.5 tracking-tight">{plan.name}</h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black text-white">R$ {plan.price}</span>
                                            <span className="text-slate-500 text-[8px] uppercase">/{plan.period === 'mensal' ? 'mês' : plan.period}</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-2 mb-6">
                                        {plan.features?.map((feat: string, fIdx: number) => (
                                            <div key={fIdx} className="flex items-start gap-1.5">
                                                <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5 border border-emerald-500/10">
                                                    <Check size={10} className="text-emerald-500" />
                                                </div>
                                                <span className="text-slate-400 text-[11px] leading-tight tracking-tight">{feat.replace(/\*\*/g, '')}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className={`w-full py-2 rounded-lg font-black text-[9px] uppercase tracking-tighter transition-all duration-300 text-center ${
                                        selectedPlan?.name === plan.name 
                                            ? 'bg-blue-600 text-white' 
                                            : 'bg-white/5 text-slate-400 group-hover:bg-white/10'
                                    }`}>
                                        {selectedPlan?.name === plan.name ? 'Selecionado' : 'Escolher Plan'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Billing Sidebar (Right - 5 cols) */}
                    <div className="md:col-span-5 lg:col-span-5 md:sticky md:top-6">
                        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl border border-white/10 p-5 shadow-2xl relative overflow-hidden">
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-500 border border-blue-500/10">
                                    <Building2 size={16} />
                                </div>
                                <h4 className="text-[11px] font-black text-white uppercase tracking-widest italic">Dados de Faturamento</h4>
                            </div>
                            
                            <div className="space-y-4 mb-6">
                                <div className="space-y-1">
                                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Documento (CPF/CNPJ)</label>
                                    <input
                                        type="text"
                                        value={documentStr}
                                        onChange={(e) => { setDocumentStr(formatDocument(e.target.value)); setErrorMsg(''); }}
                                        placeholder="00.000.000/0001-00"
                                        className={`w-full bg-black/40 border ${errorMsg ? 'border-red-500/30' : 'border-white/5'} rounded-xl p-2.5 text-white placeholder:text-slate-800 focus:border-blue-500/20 transition-all outline-none text-xs font-medium`}
                                    />
                                    {errorMsg && <p className="text-red-500 text-[8px] font-bold uppercase tracking-tight ml-1">{errorMsg}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                                    <input
                                        type="text"
                                        value={phoneStr}
                                        onChange={(e) => { setPhoneStr(formatPhone(e.target.value)); setPhoneError(''); }}
                                        placeholder="+55 (00) 0000 0000"
                                        className={`w-full bg-black/40 border ${phoneError ? 'border-red-500/30' : 'border-white/5'} rounded-xl p-2.5 text-white placeholder:text-slate-800 focus:border-blue-500/20 transition-all outline-none text-xs font-medium`}
                                    />
                                    {phoneError && <p className="text-red-500 text-[8px] font-bold uppercase tracking-tight ml-1">{phoneError}</p>}
                                </div>
                            </div>

                            <div className="mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Plano</span>
                                    <span className="text-[9px] text-white font-black">{selectedPlan?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-white tracking-widest">TOTAL</span>
                                    <span className="text-lg font-black text-emerald-400">R$ {selectedPlan?.price || '0'}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handlePayment}
                                isLoading={loading}
                                className="w-full h-12 rounded-xl text-xs font-black bg-gradient-to-r from-blue-600 to-emerald-600 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                            >
                                <CreditCard size={14} />
                                ASSINAR AGORA
                            </Button>

                            <div className="mt-6 flex justify-center pt-4 border-t border-white/5">
                                <div className="flex items-center gap-1.5 text-slate-600 text-[8px] font-bold uppercase tracking-widest">
                                    <AlertTriangle size={10} className="text-amber-500/40" />
                                    Gateway Seguro Asaas®
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={async () => { await signOut(); navigate('/'); }}
                            className="w-full mt-4 text-center text-slate-700 hover:text-white transition-colors text-[8px] font-black uppercase tracking-[0.3em]"
                        >
                            Sair da Conta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
            </div>
        </div>
    );
}
