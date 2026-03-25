import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
    CheckCircle2, 
    XCircle, 
    Download, 
    ShieldCheck, 
    Clock, 
    Building2,
    Check,
    Loader2,
    FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProposalData {
    id: string;
    title: string;
    description?: string;
    total_amount: number;
    status: string;
    valid_until?: string;
    notes?: string;
    created_at: string;
    company_id?: string;
    user_id: string;
    client: {
        name: string;
        email?: string;
    };
    company: {
        name: string;
        logo_url?: string;
        email?: string;
        phone?: string;
    };
    items: any[];
}

export function PublicProposal() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [proposal, setProposal] = useState<ProposalData | null>(null);
    const [status, setStatus] = useState<'view' | 'approving' | 'approved' | 'rejected' | 'error'>('view');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (id) fetchProposal(id);
    }, [id]);

    const fetchProposal = async (proposalId: string) => {
        setLoading(true);
        try {
            // Using RPC or public table (assuming some public access for these UUIDs)
            // For now, let's use a standard select. Note: Policies must allow this for public.
            const { data, error } = await supabase
                .from('quotes')
                .select(`
                    *,
                    contact:contact_id(*),
                    items:quote_items(*),
                    company:company_id(*)
                `)
                .eq('id', proposalId)
                .single();

            if (error) throw error;

            setProposal({
                id: data.id,
                title: data.title,
                total_amount: data.total_amount,
                status: data.status,
                valid_until: data.valid_until,
                notes: data.notes,
                created_at: data.created_at,
                client: {
                    name: data.contact?.name || 'Cliente',
                    email: data.contact?.email
                },
                company: {
                    name: data.company?.name || 'Empresa',
                    logo_url: data.company?.logo_url,
                    email: data.company?.email
                },
                items: data.items || []
            } as any);

            if (data.status === 'approved') setStatus('approved');
            if (data.status === 'rejected') setStatus('rejected');

        } catch (error: any) {
            console.error('Error:', error);
            setStatus('error');
            setErrorMessage('Não foi possível carregar a proposta. Verifique o link ou entre em contato com a empresa.');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'approve' | 'reject') => {
        if (!id) return;
        setStatus('approving');
        try {
            // We'll use a public RPC or specific policy for this
            
            // 🚀 Call Edge Function to handle atomic update + CRM movement
            const { error } = await supabase.functions.invoke('crm-process-proposal', {
                body: { proposalId: id, action }
            });

            if (error) throw error;

            setStatus(action === 'approve' ? 'approved' : 'rejected');
        } catch (error: any) {
            console.error('Action error:', error);
            alert('Erro ao processar sua resposta. Por favor, tente novamente.');
            setStatus('view');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-sky-600 animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Carregando proposta...</p>
                </div>
            </div>
        );
    }

    if (status === 'error' || !proposal) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl text-center border border-red-100 dark:border-red-900/30">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-600">
                        <XCircle size={48} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-4">Ops!</h1>
                    <p className="text-slate-500 mb-8 leading-relaxed">{errorMessage}</p>
                    <button onClick={() => window.location.reload()} className="w-full py-4 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl font-black transition-transform active:scale-95 shadow-lg">
                        Tentar Novamente
                    </button>
                </div>
            </div>
        );
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-sky-200">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-200 dark:bg-sky-900/20 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-200 dark:bg-emerald-900/20 blur-[120px] rounded-full" />
            </div>            <main className="relative z-10 max-w-4xl mx-auto py-16 px-6">
                {/* Header - Centralizado e Elegante */}
                <div className="flex flex-col items-center text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="relative mb-6">
                        {proposal.company.logo_url ? (
                            <div className="relative">
                                <div className="absolute inset-0 bg-sky-200 blur-2xl opacity-20 rounded-full scale-150" />
                                <img 
                                    src={proposal.company.logo_url} 
                                    alt={proposal.company.name} 
                                    className="relative h-28 w-28 object-contain rounded-3xl shadow-xl shadow-sky-500/10 bg-white p-3 border border-slate-100 dark:border-slate-800" 
                                />
                            </div>
                        ) : (
                            <div className="h-28 w-28 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 dark:border-slate-800">
                                <Building2 className="text-sky-600" size={40} />
                            </div>
                        )}
                    </div>
                    
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                        {proposal.company.name}
                    </h2>
                    <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-1.5 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <ShieldCheck size={14} />
                        Proposta Verificada
                    </div>

                    <div className="flex items-center gap-6 mt-10">
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Emissão</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-300">{format(parseISO(proposal.created_at), 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                        <div className="text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Referência</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-300">#{id?.slice(0, 8).toUpperCase()}</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Card - Refinado e Compacto */}
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-slate-200/60 dark:shadow-none border border-white dark:border-slate-800/50 overflow-hidden">
                    {/* Status Top Bar */}
                    {status === 'approved' && (
                        <div className="bg-emerald-500 h-14 flex items-center justify-between px-8 text-white font-black text-sm uppercase tracking-widest animate-in fade-in slide-in-from-top duration-500">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={20} />
                                PROPOSTA APROVADA
                            </div>
                            <button className="flex items-center gap-2 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors text-[10px]">
                                <Download size={14} />
                                BAIXAR PDF
                            </button>
                        </div>
                    )}
                    {status === 'rejected' && (
                        <div className="bg-red-500 h-14 flex items-center justify-center gap-2 text-white font-black text-sm uppercase tracking-widest animate-in fade-in slide-in-from-top duration-500">
                            <XCircle size={20} />
                            PROPOSTA DECLINADA
                        </div>
                    )}

                    <div className="p-8 md:p-14">
                        {/* Title & Customer Information */}
                        <div className="max-w-3xl mb-14 text-center md:text-left">
                            <p className="text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-[0.4em] mb-6">Documento Oficial</p>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-10 leading-tight">
                                {proposal.title}
                            </h1>
                            
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 px-5 py-3.5 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 flex-1 min-w-[200px]">
                                    <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center text-sky-600 shadow-sm">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Para:</p>
                                        <p className="font-bold text-slate-900 dark:text-white text-base">{proposal.client.name}</p>
                                    </div>
                                </div>

                                {proposal.valid_until && (
                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 px-5 py-3.5 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 flex-1 min-w-[200px]">
                                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Válido até:</p>
                                            <p className="font-bold text-slate-900 dark:text-white text-base">
                                                {format(parseISO(proposal.valid_until), "dd 'de' MMMM", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Section - Cartões Elegantes */}
                        <div className="mb-14">
                            <h3 className="text-base font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                                <div className="w-8 h-px bg-slate-200 dark:bg-slate-800" />
                                Itens da Proposta
                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                            </h3>
                            
                            <div className="grid gap-3">
                                {proposal.items.map((item, idx) => (
                                    <div key={idx} className="group flex items-center justify-between p-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-none transition-all duration-300">
                                        <div className="flex-1 flex gap-4 items-center">
                                            <div className="w-8 h-8 rounded-full bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold border border-sky-100 dark:border-sky-800">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white mb-0.5">{item.description}</h4>
                                                {item.quantity > 1 && (
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.quantity} unidade(s)</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right pl-4">
                                            <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                                                {formatCurrency(item.total_price)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary Section - Layout Premium Semi-Dark */}
                        <div className="flex flex-col lg:flex-row justify-between items-stretch gap-8 bg-slate-900 dark:bg-slate-950 rounded-[2rem] p-8 md:p-12 text-white relative overflow-hidden ring-1 ring-white/10">
                            {/* Decorative element */}
                            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-sky-500/10 blur-[90px] rounded-full pointer-events-none" />
                            
                            <div className="flex-1 flex flex-col justify-center">
                                <h3 className="text-lg font-black mb-4 tracking-tight">Observações Adicionais</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-8 font-medium">
                                    {proposal.notes || "Sua satisfação é nossa prioridade. Esta proposta foi elaborada pensando na melhor solução para o seu negócio."}
                                </p>
                                <div className="inline-flex items-center gap-3 py-2 px-4 rounded-xl bg-white/5 border border-white/10 w-fit">
                                    <ShieldCheck size={18} className="text-emerald-400" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Security Environment</span>
                                </div>
                            </div>

                            <div className="w-full lg:w-px bg-white/10 hidden lg:block my-2" />

                            <div className="w-full lg:w-auto flex flex-col justify-center text-center lg:text-right">
                                <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.5em] mb-3">Total do Investimento</p>
                                <p className="text-5xl md:text-6xl font-black text-white tabular-nums tracking-tighter mb-8 italic">
                                    {formatCurrency(proposal.total_amount)}
                                </p>
                                
                                {status === 'view' && (
                                    <div className="flex flex-col gap-4">
                                        <button 
                                            onClick={() => handleAction('approve')}
                                            className="w-full py-5 bg-sky-500 hover:bg-sky-400 text-white rounded-2xl font-black text-xl transition-all active:scale-95 shadow-2xl shadow-sky-600/30 flex items-center justify-center gap-3 group px-10"
                                        >
                                            ACEITAR PROPOSTA
                                            <Check className="group-hover:scale-125 transition-transform" strokeWidth={3} size={24} />
                                        </button>
                                        <button 
                                            onClick={() => handleAction('reject')}
                                            className="text-slate-500 hover:text-red-400 font-bold text-[10px] uppercase tracking-[0.3em] transition-colors py-2"
                                        >
                                            Declinear Proposta
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Style Refinado */}
                <footer className="mt-24 text-center pb-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4">Securely processed by</p>
                    <div className="flex items-center justify-center gap-3 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-base shadow-lg">L</div>
                        <span className="font-black text-slate-800 dark:text-slate-200 tracking-tighter text-lg italic">LUCRO CERTO</span>
                    </div>
                </footer>
            </main>

            {/* Approving Overlay */}
            {status === 'approving' && (
                <div className="fixed inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-sky-100 dark:border-sky-900 rounded-full" />
                            <div className="w-20 h-20 border-4 border-sky-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0" />
                        </div>
                        <p className="text-xl font-black text-slate-900 dark:text-white animate-pulse">Processando Aprovação...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
