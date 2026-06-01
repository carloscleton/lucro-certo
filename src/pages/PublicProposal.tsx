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
    User,
    Shield
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
    warranty_months?: number | null;
    warranty_type?: 'individual' | 'global' | null;
    assigned_technician?: { full_name: string } | null;
    custom_technician?: { name: string } | null;
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
        settings?: any;
        warranty_module_enabled?: boolean;
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
                    assigned_technician:assigned_technician_id(full_name),
                    custom_technician:custom_technician_id(name),
                    items:quote_items(*, technician:assigned_technician_id(full_name), custom_technician:custom_technician_id(name)),
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
                warranty_months: data.warranty_months,
                warranty_type: data.warranty_type,
                assigned_technician: data.assigned_technician,
                custom_technician: data.custom_technician,
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
                    entity_type: data.company?.entity_type || 'PJ',
                    settings: data.company?.settings || {},
                    warranty_module_enabled: data.company?.warranty_module_enabled
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
                        {/* Novo Cabeçalho Oficial (Estilo Impressão/PDF - Padrão de Duas Colunas) */}
                        <div className="flex justify-between items-start gap-6 mb-6">
                            {/* Lado Esquerdo: Título e ID */}
                            <div className="text-left">
                                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">ORÇAMENTO</h1>
                                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                                    #{id?.slice(0, 8).toUpperCase()}
                                </p>
                            </div>

                            {/* Lado Direito: Logo e Informações da Empresa (Empilhadas e Alinhadas à Direita) */}
                            <div className="flex flex-col items-end text-right">
                                {proposal.company.logo_url ? (
                                    <img 
                                        src={proposal.company.logo_url} 
                                        alt={proposal.company.name} 
                                        className="h-14 object-contain mb-3 bg-white p-1 rounded-xl border border-slate-100 dark:border-slate-800/80 shadow-sm ml-auto" 
                                    />
                                ) : (
                                    <div className="h-12 w-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800 mb-3 ml-auto">
                                        <Building2 className="text-sky-600" size={20} />
                                    </div>
                                )}
                                
                                <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1.5">
                                    {proposal.company.name}
                                </h2>
                                
                                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 font-semibold">
                                    <div>
                                        {proposal.company.entity_type === 'PF' ? 'CPF: ' : 'CNPJ: '}
                                        {proposal.company.entity_type === 'PF' ? proposal.company.cpf : proposal.company.cnpj}
                                    </div>
                                    {proposal.company.email && (
                                        <div>{proposal.company.email}</div>
                                    )}
                                    {proposal.company.phone && (
                                        <div>{proposal.company.phone}</div>
                                    )}
                                    <div>
                                        Data: {format(parseISO(proposal.created_at), 'dd/MM/yyyy')}
                                    </div>
                                    {proposal.valid_until && (
                                        <div className="text-red-600 dark:text-red-400 font-bold">
                                            Válido até: {format(parseISO(proposal.valid_until + 'T00:00:00'), 'dd/MM/yyyy')}
                                        </div>
                                    )}
                                </div>
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
                                                
                                                {proposal.company.warranty_module_enabled && proposal.company.settings?.enable_service_warranty && (proposal.warranty_type || proposal.company.settings?.warranty_type || 'individual') !== 'global' && item.service_id && (
                                                    <div className="mt-2.5 flex flex-wrap gap-2 animate-in fade-in duration-200">
                                                        {(item.custom_technician?.name || item.technician?.full_name) && (
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/40 text-[10px] font-bold text-sky-600 dark:text-sky-400 border border-sky-100/50 dark:border-sky-900/30">
                                                                <User size={12} />
                                                                <span>Executor: {item.custom_technician?.name || item.technician.full_name}</span>
                                                            </div>
                                                        )}
                                                        {item.warranty_months ? (() => {
                                                            if (proposal.status === 'approved') {
                                                                const startDate = proposal.created_at ? new Date(proposal.created_at) : new Date();
                                                                const endDate = new Date(startDate);
                                                                endDate.setMonth(startDate.getMonth() + item.warranty_months);
                                                                const now = new Date();
                                                                const isActive = endDate >= now;
                                                                const formattedDate = format(endDate, "dd/MM/yyyy");
                                                                
                                                                if (isActive) {
                                                                    return (
                                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
                                                                            <ShieldCheck size={12} className="text-emerald-500" />
                                                                            <span>Garantia Ativa até {formattedDate}</span>
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                                                            <Shield size={12} />
                                                                            <span>Garantia Expirou em {formattedDate}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                            } else {
                                                                return (
                                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-100/50 dark:border-amber-900/30">
                                                                        <Clock size={12} />
                                                                        <span>Garantia de {item.warranty_months} {item.warranty_months === 1 ? 'mês' : 'meses'} após aprovação</span>
                                                                    </div>
                                                                );
                                                            }
                                                        })() : null}
                                                    </div>
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

                        {/* Global Warranty Card if applicable */}
                        {proposal.company.warranty_module_enabled && proposal.company.settings?.enable_service_warranty && (proposal.warranty_type || proposal.company.settings?.warranty_type || 'individual') === 'global' && (
                            <div className="mb-8 p-6 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-slate-800/40 dark:to-slate-800/20 rounded-3xl border border-sky-100/50 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 animate-in fade-in duration-300">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-sky-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-600/20">
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div className="text-left">
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-0.5">Garantia Técnica Integral</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                            {(proposal.custom_technician?.name || proposal.assigned_technician?.full_name) ? (
                                                <>Responsável Técnico: <span className="font-bold text-slate-900 dark:text-slate-200">{proposal.custom_technician?.name || proposal.assigned_technician?.full_name}</span></>
                                            ) : (
                                                'Este orçamento inclui cobertura de garantia técnica.'
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right">
                                    {proposal.warranty_months ? (() => {
                                        if (proposal.status === 'approved') {
                                            const startDate = proposal.created_at ? new Date(proposal.created_at) : new Date();
                                            const endDate = new Date(startDate);
                                            endDate.setMonth(startDate.getMonth() + proposal.warranty_months);
                                            const now = new Date();
                                            const isActive = endDate >= now;
                                            const formattedDate = format(endDate, "dd/MM/yyyy");
                                            
                                            if (isActive) {
                                                return (
                                                    <div className="flex flex-col items-start sm:items-end gap-1">
                                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-100/50 dark:border-emerald-900/30">
                                                            Garantia Ativa
                                                        </span>
                                                        <span className="text-xs text-slate-500 font-bold">Válida até {formattedDate}</span>
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <div className="flex flex-col items-start sm:items-end gap-1">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                                                            Garantia Expirada
                                                        </span>
                                                        <span className="text-xs text-slate-500 font-bold">Expirou em {formattedDate}</span>
                                                    </div>
                                                );
                                            }
                                        } else {
                                            return (
                                                <div className="flex flex-col items-start sm:items-end gap-1">
                                                    <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest bg-sky-100/50 dark:bg-sky-950/40 px-2.5 py-1 rounded-full border border-sky-100/20 dark:border-sky-900/30">
                                                        Cobertura Total
                                                    </span>
                                                    <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                                                        {proposal.warranty_months} {proposal.warranty_months === 1 ? 'mês' : 'meses'} de garantia
                                                    </span>
                                                </div>
                                            );
                                        }
                                    })() : (
                                        <span className="text-xs text-slate-400 italic">Sem prazo definido</span>
                                    )}
                                </div>
                            </div>
                        )}

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
