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
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (currentEntity && !documentStr) {
            setDocumentStr((currentEntity as any).document || currentEntity.cnpj || '');
        }
    }, [currentEntity]);

    const formatDocument = (v: string) => {
        const numbers = v.replace(/\D/g, '');
        if (numbers.length <= 11) {
            return numbers.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2');
        }
        return numbers.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})/, '$1-$2').substring(0, 18);
    };

    const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDocumentStr(formatDocument(e.target.value));
        setErrorMsg('');
    };

    const handlePayment = async () => {
        const cleanDoc = documentStr.replace(/\D/g, '');
        if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
            setErrorMsg('Por favor, informe um CPF ou CNPJ válido.');
            return;
        }

        setLoading(true);
        try {
            // Atualizar o cadastro se o documento for diferente do que está no banco
            const currentDoc = ((currentEntity as any)?.document || currentEntity?.cnpj || '').replace(/\D/g, '');
            if (cleanDoc !== currentDoc) {
                const { error: updateError } = await supabase
                    .from('companies')
                    .update({ cnpj: cleanDoc }) // Atualizando a coluna cnpj em vez de document
                    .eq('id', currentEntity.id);
                
                if (updateError) throw updateError;
            }

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
                window.location.href = data.paymentUrl;
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
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] p-12 border border-white/10 dark:border-slate-700/50 text-center animate-in fade-in zoom-in slide-in-from-bottom-8 duration-700">
                <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                    <div className="absolute inset-0 bg-emerald-400/20 animate-ping rounded-full duration-[2000ms]"></div>
                    <CreditCard className="w-12 h-12 text-emerald-600 dark:text-emerald-400 relative z-10" />
                </div>

                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                    {currentEntity?.subscription_status === 'past_due'
                        ? 'Assinatura Pendente 💳'
                        : `Falta pouco, ${profile?.full_name?.split(' ')[0] || ''}! ✨`}
                </h2>
                <p
                    className="text-slate-600 dark:text-slate-400 mb-10 leading-relaxed text-lg"
                    dangerouslySetInnerHTML={{
                        __html: currentEntity?.subscription_status === 'past_due'
                            ? 'Identificamos uma pendência no pagamento da sua assinatura. Regularize agora para continuar usando todos os recursos.'
                            : 'Sua conta está pronta. Ative sua assinatura para liberar todas as ferramentas do <strong>Lucro Certo</strong>.'
                    }}
                />

                <div className="space-y-4">
                    <div className="text-left mb-6">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            CPF ou CNPJ para faturamento do sistema
                        </label>
                        <input
                            type="text"
                            value={documentStr}
                            onChange={handleDocumentChange}
                            placeholder="000.000.000-00 ou 00.000.000/0000-00"
                            className={`w-full p-4 rounded-xl border bg-white dark:bg-slate-900 focus:ring-2 focus:outline-none transition-all ${
                                errorMsg
                                    ? 'border-red-500 focus:ring-red-500/20'
                                    : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/20'
                            }`}
                        />
                        {errorMsg && (
                            <p className="text-red-500 text-sm mt-2">{errorMsg}</p>
                        )}
                    </div>

                    <Button
                        onClick={handlePayment}
                        isLoading={loading}
                        className="w-full h-16 text-xl font-bold bg-emerald-600 hover:bg-emerald-700 shadow-[0_10px_40px_-5px_rgba(16,185,129,0.3)] transition-all hover:-translate-y-1 active:scale-[0.98] rounded-2xl"
                    >
                        <CreditCard className="mr-3 w-6 h-6" />
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

                <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-full w-fit mx-auto">
                        <AlertTriangle size={14} className="text-amber-500" />
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase">Gateway 100% Seguro</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
