import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { Button } from '../components/ui/Button';
import { CreditCard, AlertTriangle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

export function PaymentRequired() {
    const { profile, signOut } = useAuth();
    const { currentEntity } = useEntity();
    const [loading, setLoading] = useState(false);
    const [documentStr, setDocumentStr] = useState('');
    const [phoneStr, setPhoneStr] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const navigate = useNavigate();

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
        const numbers = v.replace(/\D/g, '');
        if (numbers.length <= 11) {
            return numbers.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2');
        }
        return numbers.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})/, '$1-$2').substring(0, 18);
    };

    const formatPhone = (v: string) => {
        let numbers = v.replace(/\D/g, '');
        
        // Auto-add 55 if it looks like a BR number without prefix
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

    const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDocumentStr(formatDocument(e.target.value));
        setErrorMsg('');
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhoneStr(formatPhone(e.target.value));
        setPhoneError('');
    };

    const handlePayment = async () => {
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
            // Atualizar o cadastro com os dados de faturamento
            const { error: updateError } = await supabase
                .from('companies')
                .update({ 
                    cnpj: cleanDoc,
                    phone: cleanPhone
                })
                .eq('id', currentEntity.id);
            
            if (updateError) throw updateError;

            const { data: { session } } = await supabase.auth.getSession();
            // Bypassing the Supabase 401 relay by using direct fetch
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
                console.error("Detalhes do Erro do Gateway:", data);
                const errorMessage = data?.error || data?.message || "Não foi possível gerar o link agora. Tente novamente em instantes.";
                alert(`Ops! Problema ao gerar pagamento:\n\n${errorMessage}`);
            }
        } catch (err) {
            console.error("Erro na requisição:", err);
            alert("Erro ao conectar com o gateway de pagamento. Verifique sua conexão.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl z-[9999] flex items-center justify-center p-4 overflow-hidden">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-[2rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] p-8 border border-white/10 dark:border-slate-700/50 text-center animate-in fade-in zoom-in slide-in-from-bottom-8 duration-700">
                <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <div className="absolute inset-0 bg-emerald-400/20 animate-ping rounded-full duration-[2000ms]"></div>
                    <CreditCard className="w-8 h-8 text-emerald-600 dark:text-emerald-400 relative z-10" />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                    {currentEntity?.subscription_status === 'past_due'
                        ? 'Assinatura Pendente 💳'
                        : currentEntity?.subscription_plan === 'trial' && (currentEntity as any)?.trial_ends_at && new Date((currentEntity as any).trial_ends_at) < new Date()
                        ? 'Período de Teste Expirado ⏳' 
                        : `Falta pouco, ${profile?.full_name?.split(' ')[0] || ''}! ✨`}
                </h2>
                <p
                    className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed text-base"
                    dangerouslySetInnerHTML={{
                        __html: currentEntity?.subscription_status === 'past_due'
                            ? 'Identificamos uma pendência no pagamento da sua assinatura. Regularize agora para continuar usando todos os recursos.'
                            : currentEntity?.subscription_plan === 'trial' && (currentEntity as any)?.trial_ends_at && new Date((currentEntity as any).trial_ends_at) < new Date()
                            ? 'Seu período de 7 dias grátis chegou ao fim. Assine agora para não perder o acesso às ferramentas do seu sistema!'
                            : 'Sua conta está pronta. Ative sua assinatura para liberar todas as ferramentas do <strong>Lucro Certo</strong>.'
                    }}
                />

                <div className="space-y-4">
                    <div className="text-left space-y-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                CPF ou CNPJ para faturamento
                            </label>
                            <input
                                type="text"
                                value={documentStr}
                                onChange={handleDocumentChange}
                                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                className={`w-full p-3 rounded-xl border bg-white dark:bg-slate-900 focus:ring-2 focus:outline-none transition-all ${
                                    errorMsg
                                        ? 'border-red-500 focus:ring-red-500/20'
                                        : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/20'
                                }`}
                            />
                            {errorMsg && (
                                <p className="text-red-500 text-sm mt-2">{errorMsg}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                WhatsApp para avisos de cobrança
                            </label>
                            <input
                                type="text"
                                value={phoneStr}
                                onChange={handlePhoneChange}
                                placeholder="+55 (00) 00000-0000"
                                className={`w-full p-3 rounded-xl border bg-white dark:bg-slate-900 focus:ring-2 focus:outline-none transition-all ${
                                    phoneError
                                        ? 'border-red-500 focus:ring-red-500/20'
                                        : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/20'
                                }`}
                            />
                            {phoneError && (
                                <p className="text-red-500 text-sm mt-2">{phoneError}</p>
                            )}
                        </div>
                    </div>

                    <Button
                        onClick={handlePayment}
                        isLoading={loading}
                        className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-[0_10px_40px_-5px_rgba(16,185,129,0.3)] transition-all hover:-translate-y-1 active:scale-[0.98] rounded-2xl"
                    >
                        <CreditCard className="mr-3 w-5 h-5" />
                        Ativar Assinatura agora
                    </Button>

                    <button
                        onClick={async () => {
                            await signOut();
                            navigate('/');
                        }}
                        className="w-full h-12 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da Conta
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-full w-fit mx-auto">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wide uppercase">Gateway 100% Seguro</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
