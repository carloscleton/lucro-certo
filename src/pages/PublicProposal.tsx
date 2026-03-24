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
    Calendar,
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
            const newStatus = action === 'approve' ? 'approved' : 'rejected';
            
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
            </div>

            <main className="relative z-10 max-w-5xl mx-auto py-12 px-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
                    <div className="flex items-center gap-4">
                        {proposal.company.logo_url ? (
                            <img src={proposal.company.logo_url} alt={proposal.company.name} className="h-16 w-16 object-contain rounded-2xl shadow-sm bg-white p-2" />
                        ) : (
                            <div className="h-16 w-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-800">
                                <Building2 className="text-sky-600" size={32} />
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-black tracking-tight">{proposal.company.name}</h2>
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                                <ShieldCheck size={14} className="text-emerald-500" />
                                Proposta Verificada
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Data de Emissão</p>
                            <p className="font-bold">{format(parseISO(proposal.created_at), 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ref.</p>
                            <p className="font-bold">#{id?.slice(0, 8).toUpperCase()}</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[3rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-white dark:border-slate-800 overflow-hidden">
                    {/* Status Top Bar */}
                    {status === 'approved' && (
                        <div className="bg-emerald-500 h-16 flex items-center justify-center gap-2 text-white font-black animate-in fade-in slide-in-from-top duration-500">
                            <CheckCircle2 size={24} />
                            PROPOSTA APROVADA
                        </div>
                    )}
                    {status === 'rejected' && (
                        <div className="bg-red-500 h-16 flex items-center justify-center gap-2 text-white font-black animate-in fade-in slide-in-from-top duration-500">
                            <XCircle size={24} />
                            PROPOSTA DECLINADA
                        </div>
                    )}

                    <div className="p-8 md:p-12">
                        {/* Title & Customer */}
                        <div className="max-w-3xl mb-12">
                            <p className="text-sky-600 dark:text-sky-400 font-bold text-sm uppercase tracking-[0.3em] mb-4">Proposta Comercial</p>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
                                {proposal.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 rounded-2xl">
                                    <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center text-sky-600">
                                        <Loader2 size={20} className="animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Para:</p>
                                        <p className="font-bold text-slate-900 dark:text-white">{proposal.client.name}</p>
                                    </div>
                                </div>

                                {proposal.valid_until && (
                                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 rounded-2xl">
                                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600">
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Válido até:</p>
                                            <p className="font-bold text-slate-900 dark:text-white">
                                                {format(parseISO(proposal.valid_until), "dd 'de' MMMM", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="mb-12">
                            <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                                <FileText className="text-sky-600" size={24} />
                                Resumo da Proposta
                            </h3>
                            <div className="space-y-4">
                                {proposal.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:border-sky-200 dark:hover:border-sky-800 transition-colors">
                                        <div className="flex-1 mb-4 md:mb-0">
                                            <h4 className="font-black text-lg mb-1">{item.description}</h4>
                                            {item.quantity > 1 && (
                                                <p className="text-sm text-slate-500 font-medium">Quantidade: {item.quantity}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-sky-600 dark:text-sky-400">{formatCurrency(item.total_price)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-12 bg-slate-900 dark:bg-slate-950 rounded-[3rem] p-12 text-white relative overflow-hidden">
                            {/* Decorative element inside summary */}
                            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-sky-500/20 blur-[80px] rounded-full" />
                            
                            <div className="flex-1">
                                <h3 className="text-xl font-black mb-4">Considerações Finais</h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-6 italic">
                                    {proposal.notes || "Sua satisfação é nossa prioridade. Esta proposta foi elaborada pensando na melhor solução para o seu negócio."}
                                </p>
                                <div className="flex items-center gap-4 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                                    <ShieldCheck size={18} />
                                    Ambiente de Segurança Lucro Certo
                                </div>
                            </div>

                            <div className="w-full md:w-auto text-right md:border-l border-slate-700 md:pl-12">
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.4em] mb-2">Total do Investimento</p>
                                <p className="text-5xl font-black text-white tabular-nums mb-4">{formatCurrency(proposal.total_amount)}</p>
                                
                                {status === 'view' && (
                                    <div className="flex flex-col gap-3">
                                        <button 
                                            onClick={() => handleAction('approve')}
                                            className="w-full py-5 bg-sky-500 hover:bg-sky-400 text-white rounded-2xl font-black text-lg transition-all active:scale-95 shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2 group"
                                        >
                                            ACEITAR PROPOSTA
                                            <Check className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                        <button 
                                            onClick={() => handleAction('reject')}
                                            className="text-slate-500 hover:text-red-400 font-bold text-xs uppercase tracking-widest transition-colors py-2"
                                        >
                                            Declinear Proposta
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status-specific screens */}
                {status === 'approved' && (
                    <div className="mt-12 text-center animate-in zoom-in-95 fade-in duration-700">
                        <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
                            <Check size={48} />
                        </div>
                        <h2 className="text-3xl font-black mb-4">Parabéns!</h2>
                        <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">Você aceitou esta proposta. O responsável já foi notificado e entrará em contato em breve para os próximos passos.</p>
                        <button className="flex items-center gap-2 mx-auto font-black text-sky-600 hover:text-sky-500 transition-colors">
                            <Download size={20} />
                            Baixar Cópia em PDF
                        </button>
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-20 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Processado por</p>
                    <div className="flex items-center justify-center gap-2">
                        <div className="w-8 h-8 bg-sky-600 rounded-lg flex items-center justify-center text-white font-black text-sm">L</div>
                        <span className="font-black text-slate-400">LUCRO CERTO</span>
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
