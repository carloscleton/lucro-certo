import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CreditCard, QrCode, FileText, CheckCircle2, AlertCircle, Rocket } from 'lucide-react';
import { Button } from '../components/ui/Button';
import axios from 'axios';

export function Checkout() {
    const { id } = useParams<{ id: string }>();
    const [charge, setCharge] = useState<any>(null);
    const [gateways, setGateways] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentResult, setPaymentResult] = useState<any>(null);

    useEffect(() => {
        async function loadCheckoutData() {
            if (!id) return;

            try {
                // 1. Load Charge
                const { data: chargeData, error: chargeError } = await supabase
                    .from('company_charges')
                    .select('*, company:companies(name, logo_url)')
                    .eq('id', id)
                    .single();

                if (chargeError) throw chargeError;
                setCharge(chargeData);

                // 2. Load Active Gateways for that company
                const { data: gatewayData, error: gatewayError } = await supabase
                    .from('company_payment_gateways')
                    .select('*')
                    .eq('company_id', chargeData.company_id)
                    .eq('is_active', true);

                if (gatewayError) throw gatewayError;
                setGateways(gatewayData);

            } catch (err: any) {
                console.error('Checkout Load Error:', err);
                setError('Não foi possível carregar as informações desta cobrança.');
            } finally {
                setLoading(false);
            }
        }

        loadCheckoutData();
    }, [id]);

    const handleProcessPayment = async (provider: string, method?: string) => {
        setProcessing(true);
        setError(null);

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/payments/process-checkout`, {
                chargeId: id,
                provider,
                method
            });

            if (response.data.success) {
                // If it's a redirect (like Stripe or Mercado Pago link)
                if (response.data.payment_link && provider !== 'mercado_pago') {
                    window.location.href = response.data.payment_link;
                } else {
                    setPaymentResult(response.data);
                }
            } else {
                throw new Error(response.data.error || 'Falha ao processar pagamento.');
            }
        } catch (err: any) {
            console.error('Processing Error:', err);
            setError(err.response?.data?.error || err.message || 'Erro ao gerar pagamento.');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center animate-pulse">
                    <Rocket className="mx-auto text-emerald-600 mb-4" size={48} />
                    <p className="text-slate-500 font-medium">Preparando seu checkout seguro...</p>
                </div>
            </div>
        );
    }

    if (error && !charge) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-xl border border-red-100 dark:border-red-900/30">
                    <AlertCircle className="mx-auto text-red-500 mb-4" size={56} />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Ops! Link Inválido</h2>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <Button onClick={() => window.location.reload()}>Tentar Novamente</Button>
                </div>
            </div>
        );
    }

    if (paymentResult) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 py-12">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 text-center shadow-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-6">
                        <CheckCircle2 size={48} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Tudo pronto!</h2>
                    <p className="text-slate-500 mb-8">Agora é só finalizar o pagamento usando as informações abaixo.</p>

                    {paymentResult.qr_code_base64 && (
                        <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-slate-100 inline-block mb-6">
                            <img src={`data:image/png;base64,${paymentResult.qr_code_base64}`} alt="PIX" className="w-56 h-56 mx-auto" />
                        </div>
                    )}

                    <div className="space-y-4">
                        {paymentResult.qr_code && (
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => {
                                    navigator.clipboard.writeText(paymentResult.qr_code);
                                    alert('Código PIX copiado!');
                                }}
                            >
                                Copiar Código PIX
                            </Button>
                        )}
                        {paymentResult.payment_link && (
                            <a href={paymentResult.payment_link} target="_blank" rel="noreferrer" className="block w-full">
                                <Button variant="outline" className="w-full">Abrir Link de Pagamento</Button>
                            </a>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const stripeGateway = gateways.find(g => g.provider === 'stripe');
    const asaasGateway = gateways.find(g => g.provider === 'asaas');
    const mpGateway = gateways.find(g => g.provider === 'mercado_pago');

    const allowedMethods = charge.payment_method === 'all'
        ? ['pix', 'credit_card', 'boleto']
        : (charge.payment_method || '').split(',');

    const hasPix = !!(mpGateway || asaasGateway || stripeGateway) && allowedMethods.includes('pix');
    const hasCard = !!(stripeGateway || asaasGateway || mpGateway) && allowedMethods.includes('credit_card');
    const hasBoleto = !!(asaasGateway || mpGateway || stripeGateway) && allowedMethods.includes('boleto');

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 py-12">
            <div className="max-w-2xl w-full">
                {/* Header Section */}
                <div className="text-center mb-8">
                    {charge.company?.logo_url ? (
                        <img src={charge.company.logo_url} alt="Logo" className="h-16 mx-auto mb-4" />
                    ) : (
                        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg">
                            {charge.company?.name?.charAt(0)}
                        </div>
                    )}
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{charge.company?.name}</h1>
                    <p className="text-slate-500">Checkout Seguro via Vinx</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-5">
                        {/* Summary Sidebar */}
                        <div className="md:col-span-2 bg-slate-50/50 dark:bg-slate-800/50 p-8 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Resumo da Cobrança</h3>

                            <div className="space-y-6">
                                <div>
                                    <span className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.amount)}
                                    </span>
                                </div>

                                <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white mb-1">Descrição</p>
                                    <p className="text-sm text-slate-500 leading-relaxed">{charge.description}</p>
                                </div>

                                <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                        <CheckCircle2 size={12} className="text-emerald-500" />
                                        Pagamento Criptografado
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Selection */}
                        <div className="md:col-span-3 p-8">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Como deseja pagar?</h3>

                            <div className="space-y-3">
                                {hasPix && (
                                    <button
                                        onClick={() => handleProcessPayment((mpGateway || asaasGateway || stripeGateway).provider, 'pix')}
                                        disabled={processing}
                                        className="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-emerald-500 dark:hover:border-emerald-500 transition-all hover:shadow-lg group"
                                    >
                                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                                            <QrCode size={24} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <span className="block font-bold text-slate-900 dark:text-white">PIX</span>
                                            <span className="text-xs text-slate-500">Pagamento instantâneo e seguro</span>
                                        </div>
                                    </button>
                                )}

                                {hasCard && (
                                    <button
                                        onClick={() => handleProcessPayment((stripeGateway || asaasGateway || mpGateway).provider, 'credit_card')}
                                        disabled={processing}
                                        className="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg group"
                                    >
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                                            <CreditCard size={24} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <span className="block font-bold text-slate-900 dark:text-white">Cartão de Crédito ou Débito</span>
                                            <span className="text-xs text-slate-500">Pague com segurança via {(stripeGateway || asaasGateway || mpGateway).provider.replace('_', ' ')}</span>
                                        </div>
                                    </button>
                                )}

                                {hasBoleto && (
                                    <button
                                        onClick={() => handleProcessPayment((asaasGateway || mpGateway || stripeGateway).provider, 'boleto')}
                                        disabled={processing}
                                        className="w-full flex items-center gap-4 p-5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all hover:shadow-lg group"
                                    >
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
                                            <FileText size={24} />
                                        </div>
                                        <div className="text-left flex-1">
                                            <span className="block font-bold text-slate-900 dark:text-white">Boleto Bancário</span>
                                            <span className="text-xs text-slate-500">Pague via boleto bancário</span>
                                        </div>
                                    </button>
                                )}
                            </div>

                            {processing && (
                                <div className="mt-6 text-center text-sm text-emerald-600 animate-pulse font-medium">
                                    Processando sua solicitação segura...
                                </div>
                            )}

                            {error && (
                                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl text-xs text-red-600 text-center">
                                    {error}
                                </div>
                            )}

                            <div className="mt-12 text-center opacity-30 select-none grayscale">
                                <span className="text-[10px] font-bold tracking-tighter block mb-2 uppercase text-slate-400">Processado por</span>
                                <div className="flex items-center justify-center gap-4">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-4" />
                                    <img src="https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo.png" alt="Mercado Pago" className="h-3" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="mt-8 text-center text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                    &copy; {new Date().getFullYear()} {charge.company?.name} &bull; Ambiente 100% Criptografado
                </p>
            </div>
        </div>
    );
}
