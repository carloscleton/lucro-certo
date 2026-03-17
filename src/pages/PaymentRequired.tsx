import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { Button } from '../components/ui/Button';
import { CreditCard, AlertTriangle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState } from 'react';

export function PaymentRequired() {
    const { profile, signOut } = useAuth();
    const { currentEntity } = useEntity();
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handlePayment = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const { data } = await supabase.functions.invoke('platform-checkout', {
                body: {
                    company_id: currentEntity.id,
                    access_token: session?.access_token // Bypassing 401 relay
                }
            });

            if (data?.paymentUrl) {
                window.location.href = data.paymentUrl;
            } else {
                alert("Não foi possível gerar o link agora. Tente novamente em instantes.");
            }
        } catch (err) {
            console.error(err);
            alert("Erro ao conectar com o gateway de pagamento.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-[0_32px_128px_-15px_rgba(0,0,0,0.3)] p-10 border border-slate-100 dark:border-slate-700/50 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                    <div className="absolute inset-0 bg-emerald-400/20 animate-ping rounded-full duration-[2000ms]"></div>
                    <CreditCard className="w-12 h-12 text-emerald-600 dark:text-emerald-400 relative z-10" />
                </div>

                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                    Falta pouco, {profile?.full_name?.split(' ')[0] || ''}! ✨
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-10 leading-relaxed text-lg">
                    Sua conta está pronta. Ative sua assinatura para liberar todas as ferramentas do <strong>Lucro Certo</strong>.
                </p>

                <div className="space-y-4">
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
