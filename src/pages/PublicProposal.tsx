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
    Loader2
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
        cnpj?: string;
        cpf?: string;
        entity_type?: 'PF' | 'PJ';
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
                    email: data.company?.email,
                    phone: data.company?.phone,
                    cnpj: data.company?.cnpj,
                    cpf: data.company?.cpf,
                    entity_type: data.company?.entity_type || 'PJ'
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
        const currency = (proposal as any)?.company?.currency || 'BRL';
        const localeMap: Record<string, string> = { BRL: 'pt-BR', USD: 'en-US', EUR: 'pt-PT', PYG: 'es-PY', ARS: 'es-AR' };
        const locale = localeMap[currency] || 'pt-BR';
        
        return new Intl.NumberFormat(locale, { 
            style: 'currency', 
            currency: currency 
        }).format(val);
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans selection:bg-sky-200">
            {/* Background Decorations */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-200 dark:bg-sky-900/20 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-200 dark:bg-emerald-900/20 blur-[120px] rounded-full" />
            </div>
            <main className="relative z-10 max-w-4xl mx-auto py-16 px-6">
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
                        {/* Novo Cabeçalho Oficial (Estilo Impressão/PDF - Horizontal) */}
                        <div className="flex flex-col gap-5 mb-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="flex flex-col text-left">
                                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">ORÇAMENTO</h1>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">#{id?.slice(0, 8).toUpperCase()}</span>
                                        <div className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-100/50 dark:border-emerald-900/30">
                                            <ShieldCheck size={10} />
                                            Proposta Verificada
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 text-left">
                                    {proposal.company.logo_url ? (
                                        <img 
                                            src={proposal.company.logo_url} 
                                            alt={proposal.company.name} 
                                            className="h-12 w-12 object-contain bg-white p-1 rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-sm" 
                                        />
                                    ) : (
                                        <div className="h-12 w-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800">
                                            <Building2 className="text-sky-600" size={20} />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">
                                            {proposal.company.name}
                                        </h2>
                                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                            Prestador de Serviços
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Linha Horizontal de Metadados da Empresa & Validade */}
                            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                                <div className="flex items-center gap-1">
                                    <span className="font-extrabold text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">CNPJ/CPF:</span>
                                    <span className="font-bold">{proposal.company.entity_type === 'PF' ? proposal.company.cpf : proposal.company.cnpj}</span>
                                </div>
                                {proposal.company.email && (
                                    <>
                                        <span className="text-slate-200 dark:text-slate-800 font-normal">|</span>
                                        <div className="flex items-center gap-1">
                                            <span className="font-extrabold text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">E-mail:</span>
                                            <span className="font-bold">{proposal.company.email}</span>
                                        </div>
                                    </>
                                )}
                                {proposal.company.phone && (
                                    <>
                                        <span className="text-slate-200 dark:text-slate-800 font-normal">|</span>
                                        <div className="flex items-center gap-1">
                                            <span className="font-extrabold text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Telefone:</span>
                                            <span className="font-bold">{proposal.company.phone}</span>
                                        </div>
                                    </>
                                )}
                                <>
                                    <span className="text-slate-200 dark:text-slate-800 font-normal">|</span>
                                    <div className="flex items-center gap-1">
                                        <span className="font-extrabold text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Emissão:</span>
                                        <span className="font-bold">{format(parseISO(proposal.created_at), 'dd/MM/yyyy')}</span>
                                    </div>
                                </>
                                {proposal.valid_until && (
                                    <>
                                        <span className="text-slate-200 dark:text-slate-800 font-normal">|</span>
                                        <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                            <span className="font-extrabold text-[9px] text-red-400 dark:text-red-500 uppercase tracking-wider">Válido até:</span>
                                            <span className="font-black">{format(parseISO(proposal.valid_until + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-full h-px bg-slate-100 dark:bg-slate-800/50 mb-8" />
                        {/* Title & Customer Information */}
                        <div className="max-w-3xl mb-8 text-center md:text-left">
                            <p className="text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-[0.4em] mb-4">Documento Oficial</p>
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
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
                                                {format(parseISO(proposal.valid_until + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items Section - Cartões Elegantes */}
                        <div className="mb-10">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                <div className="w-6 h-px bg-slate-200 dark:bg-slate-800" />
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

                        {/* Summary Section - Layout Clean & Compact */}
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-800/80 relative overflow-hidden">
                            <div className="flex-1 flex flex-col text-left">
                                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Observações Adicionais</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-semibold max-w-lg">
                                    {proposal.notes || "Sua satisfação é nossa prioridade. Esta proposta foi elaborada pensando na melhor solução para o seu negócio."}
                                </p>
                                <div className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                    <ShieldCheck size={14} className="text-emerald-500" />
                                    <span>Ambiente de Navegação Seguro</span>
                                </div>
                            </div>

                            <div className="w-full lg:w-px bg-slate-200 dark:bg-slate-800 hidden lg:block self-stretch my-1" />

                            <div className="w-full lg:w-auto flex flex-col justify-center text-left lg:text-right">
                                <p className="text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-widest">Total do Investimento</p>
                                <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight mt-1">
                                    {formatCurrency(proposal.total_amount)}
                                </p>
                                
                                {status === 'view' && (
                                    <div className="flex flex-col gap-2 mt-4">
                                        <button 
                                            onClick={() => handleAction('approve')}
                                            className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-black text-sm transition-all active:scale-95 shadow-md shadow-sky-600/10 flex items-center justify-center gap-2 group px-8"
                                        >
                                            ACEITAR PROPOSTA
                                            <Check className="group-hover:scale-110 transition-transform" strokeWidth={2.5} size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleAction('reject')}
                                            className="text-slate-400 hover:text-red-500 font-bold text-[10px] uppercase tracking-widest transition-colors py-1.5"
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
