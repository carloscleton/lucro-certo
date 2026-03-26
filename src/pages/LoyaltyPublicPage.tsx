import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Award, Check, Rocket, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function LoyaltyPublicPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [company, setCompany] = useState<any>(null);
    const [plans, setPlans] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadPublicData() {
            if (!slug) return;
            setLoading(true);
            try {
                // 1. Fetch Company by Slug
                const { data: companyData, error: companyError } = await supabase
                    .from('companies')
                    .select('id, trade_name, logo_url, loyalty_module_enabled')
                    .eq('slug', slug)
                    .single();

                if (companyError || !companyData) throw new Error('Empresa não encontrada.');
                if (!companyData.loyalty_module_enabled) throw new Error('O Clube de Fidelidade não está ativo para esta empresa.');
                
                setCompany(companyData);

                // 2. Fetch Active Plans
                const { data: plansData, error: plansError } = await supabase
                    .from('loyalty_plans')
                    .select('*')
                    .eq('company_id', companyData.id)
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });

                if (plansError) throw plansError;
                setPlans(plansData || []);

            } catch (err: any) {
                console.error('Loyalty Load Error:', err);
                setError(err.message || 'Erro ao carregar o clube.');
            } finally {
                setLoading(false);
            }
        }

        loadPublicData();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" strokeWidth={3} />
                    <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Acessando Clube VIP...</p>
                </div>
            </div>
        );
    }

    if (error || !company) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 text-center shadow-2xl border border-red-100 dark:border-red-900/30">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-600">
                        <Award size={48} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-4 italic tracking-tight uppercase">Módulo Indisponível</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed font-medium">{error || 'Este clube ainda não foi configurado.'}</p>
                    <button onClick={() => navigate('/')} className="w-full py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black transition-transform active:scale-95 shadow-lg">
                        Voltar ao Início
                    </button>
                </div>
            </div>
        );
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-amber-200">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-200 dark:bg-amber-900/20 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200 dark:bg-blue-900/20 blur-[120px] rounded-full" />
            </div>

            <nav className="relative z-10 p-6 flex items-center justify-between max-w-7xl mx-auto">
                <div className="flex items-center gap-4">
                    {company.logo_url ? (
                        <img src={company.logo_url} alt={company.trade_name} className="h-10 w-auto object-contain" />
                    ) : (
                        <div className="h-10 w-10 bg-amber-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-amber-500/20">
                            {company.trade_name.charAt(0)}
                        </div>
                    )}
                    <span className="font-black text-lg tracking-tighter uppercase italic">{company.trade_name}</span>
                </div>
                <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <ShieldCheck size={14} className="text-amber-500" />
                    Ambiente Autenticado
                </div>
            </nav>

            <main className="relative z-10 max-w-7xl mx-auto py-16 px-6">
                {/* Hero Section */}
                <div className="text-center mb-24 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-5 py-2 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
                        <Award size={16} />
                        Clube de Fidelidade VIP
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white mb-8 tracking-tighter leading-[0.9] uppercase italic animate-in fade-in slide-in-from-top-4 duration-700 delay-100">
                        Seja mais que um <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-600">cliente comum.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-500 dark:text-gray-400 mb-12 font-medium leading-relaxed animate-in fade-in slide-in-from-top-6 duration-1000 delay-300">
                        Assine um de nossos planos e garanta benefícios exclusivos, descontos automáticos e prioridade em todos os nossos serviços.
                    </p>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
                    {plans.map((plan, idx) => (
                        <div 
                            key={plan.id} 
                            className={`relative group bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl transition-all duration-500 hover:-translate-y-2 border ${idx === 1 ? 'border-amber-400 dark:border-amber-600 ring-4 ring-amber-400/10' : 'border-slate-100 dark:border-slate-800'}`}
                            style={{ animationDelay: `${idx * 150}ms` }}
                        >
                            {idx === 1 && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/30">
                                    Mais Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter italic">{plan.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed h-12 line-clamp-2">
                                    {plan.description || 'Acesso exclusivo aos nossos melhores serviços e condições.'}
                                </p>
                            </div>

                            <div className="mb-10">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter italic">
                                        {formatCurrency(plan.price).split(',')[0]}
                                    </span>
                                    <span className="text-xl font-black text-slate-400 tabular-nums tracking-tighter italic">
                                        ,{formatCurrency(plan.price).split(',')[1]}
                                    </span>
                                    <span className="text-slate-400 font-bold ml-1">/mês</span>
                                </div>
                                {plan.discount_percent > 0 && (
                                    <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                        <ArrowRight size={14} className="rotate-[-45deg]" />
                                        {plan.discount_percent}% de Desconto em Serviços
                                    </div>
                                )}
                            </div>

                            <ul className="space-y-4 mb-12">
                                <li className="flex items-start gap-3">
                                    <div className="bg-amber-100 dark:bg-amber-900/30 p-0.5 rounded-full mt-1">
                                        <Check size={14} className="text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Status VIP verificado em check-in</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-amber-100 dark:bg-amber-900/30 p-0.5 rounded-full mt-1">
                                        <Check size={14} className="text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Prioridade no agendamento</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="bg-amber-100 dark:bg-amber-900/30 p-0.5 rounded-full mt-1">
                                        <Check size={14} className="text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Suporte prioritário via WhatsApp</span>
                                </li>
                            </ul>

                            <Button 
                                className={`w-full py-6 rounded-2xl font-black text-xl italic uppercase tracking-tighter transition-all group overflow-hidden ${idx === 1 ? 'bg-amber-600 hover:bg-amber-700 shadow-2xl shadow-amber-500/30' : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'}`}
                                onClick={() => navigate(`/checkout/loyalty/${plan.id}`)}
                            >
                                <span className="relative z-10 flex items-center justify-center gap-3">
                                    Assinar Agora
                                    <Rocket size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                </span>
                            </Button>
                        </div>
                    ))}
                </div>

                {/* Social Proof Section */}
                <div className="bg-slate-900 dark:bg-slate-100 rounded-[3rem] p-12 md:p-20 text-white dark:text-slate-900 relative overflow-hidden shadow-3xl">
                    <div className="absolute top-0 right-0 p-12 opacity-10">
                        <Award size={200} />
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                        <div className="max-w-xl text-center md:text-left">
                            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tighter leading-none italic uppercase">Faça parte de um <br/>grupo seleto.</h2>
                            <p className="text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                Nossos assinantes economizam em média 35% por ano em serviços recorrentes e possuem a garantia de prioridade máxima em nossa operação.
                            </p>
                        </div>
                        <div className="flex -space-x-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="w-16 h-16 rounded-full border-4 border-slate-900 dark:border-white bg-slate-800 flex items-center justify-center overflow-hidden">
                                     <img src={`https://i.pravatar.cc/150?u=${i + 100}`} alt="Avatar" className="w-full h-full object-cover" />
                                </div>
                            ))}
                            <div className="w-16 h-16 rounded-full border-4 border-slate-900 dark:border-white bg-amber-500 flex items-center justify-center text-white font-black text-xs">
                                +500
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="mt-32 text-center pb-12">
                    <div className="flex items-center justify-center gap-4 grayscale opacity-40 mb-6 font-black italic tracking-tighter text-xl uppercase">
                        <span>{company.trade_name}</span>
                        <div className="w-1 h-1 bg-slate-400 rounded-full" />
                        <span className="text-slate-500">Lucro Certo</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">
                        Segurança Garantida &bull; Pagamento Criptografado
                    </p>
                </footer>
            </main>
        </div>
    );
}
