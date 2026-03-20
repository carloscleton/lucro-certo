import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { Button } from '../components/ui/Button';
import { CreditCard, AlertTriangle, Check, Sparkles, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import logoFull from '../assets/logo-full.png';

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
        <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] to-[#ffffff] text-slate-900 selection:bg-blue-500/10 overflow-x-hidden font-sans">
            {/* Minimal Decorative Elements */}
            <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[10%] left-[-10%] w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto px-4 py-4 lg:py-8">
                {/* Logo & Compact Header */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-top-2 duration-700">
                    <div className="flex justify-center mb-6">
                        <img src={logoFull} alt="Lucro Certo" className="h-14 w-auto drop-shadow-sm" />
                    </div>
                    
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/5 border border-blue-600/10 text-blue-600 text-[9px] font-bold uppercase tracking-widest mb-3">
                        <Sparkles size={10} strokeWidth={3} />
                        Assinatura Premium
                    </div>
                    
                    <h1 className="text-2xl md:text-3xl font-black mb-1.5 tracking-tight text-slate-900">
                        {currentEntity?.subscription_plan === 'trial' ? 'Acelere sua Gestão agora.' : 'Ative sua conta Premium.'}
                    </h1>
                    <p className="text-slate-500 text-[12px] md:text-sm max-w-lg mx-auto font-medium">
                        Escolha o plano ideal e libere o poder completo do seu sistema financeiro.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* Plans Grid (Left - 7 cols) */}
                    <div className="md:col-span-7 lg:col-span-7 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {plans.map((plan: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedPlan(plan)}
                                    className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all duration-300 flex flex-col group ${
                                        selectedPlan?.name === plan.name 
                                            ? 'bg-white border-blue-600 shadow-xl shadow-blue-900/10 ring-1 ring-blue-600/10' 
                                            : 'bg-white/50 border-slate-200 hover:border-blue-300 hover:bg-white'
                                    }`}
                                >
                                    {plan.is_popular && (
                                        <div className="absolute -top-3 left-6 bg-blue-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md">
                                            RECOMENDADO
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <h3 className="text-sm font-black text-slate-900 mb-0.5 tracking-tight">{plan.name}</h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-blue-600">R$ {plan.price}</span>
                                            <span className="text-slate-400 text-[9px] font-bold uppercase">/{plan.period === 'mensal' ? 'mês' : plan.period}</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-2.5 mb-6">
                                        {plan.features?.map((feat: string, fIdx: number) => (
                                            <div key={fIdx} className="flex items-start gap-2">
                                                <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5">
                                                    <Check size={11} className="text-emerald-500" strokeWidth={3} />
                                                </div>
                                                <span className="text-slate-600 text-[12px] leading-tight font-medium">{feat.replace(/\*\*/g, '')}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all duration-300 text-center ${
                                        selectedPlan?.name === plan.name 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-300' 
                                            : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                                    }`}>
                                        {selectedPlan?.name === plan.name ? 'Selecionado' : 'Escolher este Plano'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Billing Sidebar (Right - 5 cols) */}
                    <div className="md:col-span-5 lg:col-span-5 md:sticky md:top-6">
                        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl shadow-blue-900/5 relative overflow-hidden">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-9 h-9 bg-blue-600/5 rounded-xl flex items-center justify-center text-blue-600 border border-blue-600/10">
                                    <Building2 size={18} strokeWidth={2.5} />
                                </div>
                                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Finalizar Assinatura</h4>
                            </div>
                            
                            <div className="space-y-4 mb-6">
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento (CPF/CNPJ)</label>
                                    <input
                                        type="text"
                                        value={documentStr}
                                        onChange={(e) => { setDocumentStr(formatDocument(e.target.value)); setErrorMsg(''); }}
                                        placeholder="00.000.000/0001-00"
                                        className={`w-full bg-slate-50 border-2 ${errorMsg ? 'border-red-200' : 'border-slate-100'} rounded-2xl p-3 text-slate-900 placeholder:text-slate-300 focus:border-blue-600/30 focus:bg-white transition-all outline-none text-sm font-semibold`}
                                    />
                                    {errorMsg && <p className="text-red-500 text-[9px] font-bold uppercase tracking-tight ml-1">{errorMsg}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                                    <input
                                        type="text"
                                        value={phoneStr}
                                        onChange={(e) => { setPhoneStr(formatPhone(e.target.value)); setPhoneError(''); }}
                                        placeholder="+55 (00) 00000-0000"
                                        className={`w-full bg-slate-50 border-2 ${phoneError ? 'border-red-200' : 'border-slate-100'} rounded-2xl p-3 text-slate-900 placeholder:text-slate-300 focus:border-blue-600/30 focus:bg-white transition-all outline-none text-sm font-semibold`}
                                    />
                                    {phoneError && <p className="text-red-500 text-[9px] font-bold uppercase tracking-tight ml-1">{phoneError}</p>}
                                </div>
                            </div>

                            <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Plano Selecionado</span>
                                    <span className="text-[10px] text-slate-900 font-black">{selectedPlan?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-slate-900 tracking-widest uppercase">Total a Pagar</span>
                                    <span className="text-2xl font-black text-blue-600">R$ {selectedPlan?.price || '0'}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handlePayment}
                                isLoading={loading}
                                className="w-full h-14 rounded-2xl text-sm font-black bg-blue-600 hover:bg-blue-700 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20"
                            >
                                <CreditCard size={18} />
                                CONCLUIR E PAGAR
                            </Button>

                            <div className="mt-8 flex justify-center pt-6 border-t border-slate-100">
                                <div className="flex items-center gap-2 text-slate-400 text-[9px] font-bold uppercase tracking-widest">
                                    <AlertTriangle size={12} className="text-amber-500/60" />
                                    Ambiente 100% Seguro Asaas®
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={async () => { await signOut(); navigate('/'); }}
                            className="w-full mt-6 text-center text-slate-400 hover:text-blue-600 transition-colors text-[9px] font-black uppercase tracking-[0.4em]"
                        >
                            Sair e Voltar depois
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
