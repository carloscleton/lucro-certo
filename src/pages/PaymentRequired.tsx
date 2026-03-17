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
                body: { company_id: currentEntity.id },
                headers: { Authorization: `Bearer ${session?.access_token}` }
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
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[9999] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CreditCard className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Falta pouco, {profile?.full_name?.split(' ')[0] || ''}! ✨
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8">
                    Sua conta foi criada com sucesso. Agora, conclua a ativação da sua assinatura para liberar o acesso ao sistema.
                </p>

                <div className="space-y-4">
                    <Button
                        onClick={handlePayment}
                        isLoading={loading}
                        className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                    >
                        <CreditCard className="mr-2" />
                        Concluir e Entrar
                    </Button>

                    <Button
                        onClick={async () => {
                            await signOut();
                            navigate('/');
                        }}
                        variant="ghost"
                        className="w-full text-slate-400 hover:text-slate-600"
                    >
                        <LogOut className="mr-2 w-4 h-4" />
                        Sair da Conta
                    </Button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex items-center justify-center gap-2 text-xs text-slate-400">
                    <AlertTriangle size={14} className="text-amber-500" />
                    Pagamento 100% Seguro via Gateway
                </div>
            </div>
        </div>
    );
}
