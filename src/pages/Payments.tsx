import { useState, useMemo } from 'react';
import {
    CreditCard,
    Plus,
    Search,
    ArrowDownLeft,
    Clock,
    CheckCircle2,
    XCircle,
    Copy,
    Smartphone,
    ExternalLink,
    AlertCircle,
    Trash2,
    QrCode,
    FileText,
    Link as LinkIcon
} from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useCharges } from '../hooks/useCharges';
import { useContacts } from '../hooks/useContacts';
import { usePaymentGateways } from '../hooks/usePaymentGateways';
import { useQuotes } from '../hooks/useQuotes';
import { useNotification } from '../context/NotificationContext';
import { useEntity } from '../context/EntityContext';
import { supabase } from '../lib/supabase';

export function Payments() {
    const { currentEntity } = useEntity();
    const { charges, loading: loadingCharges, createCharge, deleteCharge } = useCharges();
    const { contacts } = useContacts();
    const { gateways } = usePaymentGateways();
    const { quotes } = useQuotes();
    const { notify } = useNotification();

    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);

    // Form state
    const [selectedContactId, setSelectedContactId] = useState('');
    const [selectedQuoteId, setSelectedQuoteId] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('');
    const [selectedMethods, setSelectedMethods] = useState<string[]>(['pix', 'credit_card', 'boleto']);
    const [result, setResult] = useState<any>(null);
    const [viewingCharge, setViewingCharge] = useState<any>(null);

    const activeGateways = gateways.filter(g => g.is_active);
    const approvedQuotes = useMemo(() => {
        return quotes.filter(q => q.status === 'approved' && q.payment_status !== 'paid');
    }, [quotes]);

    const stats = useMemo(() => {
        const approved = charges
            .filter(c => c.status === 'approved')
            .reduce((acc, curr) => acc + Number(curr.amount), 0);

        const pending = charges
            .filter(c => c.status === 'pending')
            .reduce((acc, curr) => acc + Number(curr.amount), 0);

        const activeLinks = charges.filter(c => c.status === 'pending').length;

        return [
            { label: 'Total Recebido', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(approved), color: 'emerald', icon: ArrowDownLeft },
            { label: 'Pendente', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pending), color: 'amber', icon: Clock },
            { label: 'Links Ativos', value: activeLinks.toString(), color: 'blue', icon: CreditCard },
        ];
    }, [charges]);

    const filteredCharges = useMemo(() => {
        return charges.filter(c =>
            c.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.external_reference.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [charges, searchTerm]);

    const handleCreate = async () => {
        if (!selectedContactId || !amount || !selectedProvider) {
            notify('warning', 'Atenção', 'Preencha todos os campos obrigatórios.');
            return;
        }

        // Duplicity check: Don't allow new link if one is already pending for this quote
        if (selectedQuoteId) {
            const existingCharge = charges.find(c => c.quote_id === selectedQuoteId && c.status === 'pending');
            if (existingCharge) {
                notify('warning', 'Link Pendente Identificado', 'Já existe um link de pagamento ativo para este orçamento. Exclua a cobrança anterior na lista para gerar um novo.');
                return;
            }
        }

        const contact = contacts.find(c => c.id === selectedContactId);
        const gateway = selectedProvider === 'unified' ? null : gateways.find(g => g.provider === selectedProvider);

        if (!contact || (selectedProvider !== 'unified' && !gateway)) return;

        setCreating(true);
        try {
            if (selectedProvider === 'unified') {
                // For unified, we just save the charge record and return the internal link
                const { data, error } = await supabase
                    .from('company_charges')
                    .insert({
                        company_id: currentEntity.id,
                        customer_id: selectedContactId,
                        quote_id: selectedQuoteId || null,
                        provider: 'unified',
                        amount: Number(amount),
                        description,
                        external_reference: `VINX_${Date.now()}`,
                        payment_method: selectedMethods.length === 3 ? 'all' : selectedMethods.join(','),
                        status: 'pending',
                        is_sandbox: gateways.some(g => g.is_sandbox) // Assume sandbox if any is
                    })
                    .select()
                    .single();

                if (error) throw error;

                const internalLink = `${window.location.origin}/pay/${data.id}`;
                const { data: updated } = await supabase
                    .from('company_charges')
                    .update({ payment_link: internalLink })
                    .eq('id', data.id)
                    .select()
                    .single();

                setResult(updated);
            } else if (gateway) {
                const selectedMethod = selectedProvider === 'unified' ? 'all' : (selectedMethods[0] || 'pix');

                const res = await createCharge({
                    provider: selectedProvider as any,
                    config: gateway.config,
                    is_sandbox: gateway.is_sandbox,
                    customerId: selectedContactId,
                    quoteId: selectedQuoteId || undefined,
                    payload: {
                        amount: Number(amount),
                        description,
                        payment_method: selectedMethod as any,
                        customer: {
                            name: contact.name,
                            email: contact.email || 'financeiro@exemplo.com',
                            tax_id: contact.tax_id || undefined
                        }
                    }
                });

                if (res.success) {
                    setResult(res);
                } else {
                    notify('error', 'Erro', res.error || 'Falha ao gerar cobrança.');
                    setCreating(false);
                    return;
                }
            }

            notify('success', 'Sucesso', 'Cobrança gerada com sucesso!');
        } catch (error: any) {
            console.error('Create Charge Error:', error);
            notify('error', 'Erro', error.message || 'Erro ao gerar cobrança.');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (charge: any) => {
        if (!window.confirm('Tem certeza que deseja apagar esta cobrança? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            const res = await deleteCharge(charge.id);
            if (res.success) {
                notify('success', 'Sucesso', 'Cobrança removida!');
            } else {
                notify('error', 'Erro', 'Falha ao remover cobrança.');
            }
        } catch (error) {
            notify('error', 'Erro', 'Erro de conexão.');
        }
    };

    const resetForm = () => {
        setSelectedContactId('');
        setSelectedQuoteId('');
        setAmount('');
        setDescription('');
        setSelectedProvider(activeGateways[0]?.provider || 'unified');
        setSelectedMethods(['pix', 'credit_card', 'boleto']);
        setResult(null);
        setViewingCharge(null);
        setIsModalOpen(false);
    };

    const handleSelectQuote = (quoteId: string) => {
        setSelectedQuoteId(quoteId);
        const quote = approvedQuotes.find(q => q.id === quoteId);
        if (quote) {
            setAmount(quote.total_amount.toString());
            setDescription(`Orçamento #${quote.quote_number || quote.id.slice(0, 8)}: ${quote.title}`);
            setSelectedContactId(quote.contact_id || '');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pagamentos</h1>
                    <p className="text-gray-500 dark:text-slate-400">Gestão de cobranças e faturamento em tempo real.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                            setSelectedProvider(activeGateways[0]?.provider || '');
                            setIsModalOpen(true);
                        }}
                    >
                        <Plus size={18} className="mr-2" />
                        Novo Link/Cobrança
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/10 text-${stat.color}-600`}>
                                <stat.icon size={24} />
                            </div>
                        </div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">{stat.label}</h3>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* List Control */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente ou descrição..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loadingCharges ? (
                        <div className="p-12 text-center text-gray-500">Carregando transações...</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-900/50 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    <th className="px-6 py-4">Cliente / Referência</th>
                                    <th className="px-6 py-4">Valor</th>
                                    <th className="px-6 py-4 text-center">Modo</th>
                                    <th className="px-6 py-4">Data</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                                {filteredCharges.map((charge) => (
                                    <tr key={charge.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 dark:text-white">{charge.customer?.name || 'Cliente Geral'}</span>
                                                <span className="text-xs text-gray-400 font-mono">{charge.external_reference}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(charge.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${charge.is_sandbox
                                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                }`}>
                                                {charge.is_sandbox ? 'Teste' : 'Prod'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(charge.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${charge.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                charge.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {charge.status === 'approved' ? <CheckCircle2 size={12} className="mr-1" /> :
                                                    charge.status === 'pending' ? <Clock size={12} className="mr-1" /> :
                                                        <XCircle size={12} className="mr-1" />}
                                                {charge.status === 'approved' ? 'Pago' :
                                                    charge.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Tooltip content="Ver Detalhes do Pagamento">
                                                    <button
                                                        onClick={() => setViewingCharge(charge)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-emerald-600 transition-colors"
                                                    >
                                                        <Search size={16} />
                                                    </button>
                                                </Tooltip>
                                                {charge.payment_link && (
                                                    <Tooltip content={charge.is_sandbox ? "Abrir Link (Pode exigir login sandbox)" : "Abrir Link de Pagamento"}>
                                                        <a
                                                            href={charge.payment_link}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-blue-500 transition-colors"
                                                        >
                                                            <ExternalLink size={16} />
                                                        </a>
                                                    </Tooltip>
                                                )}
                                                <Tooltip content={charge.qr_code ? "Copiar Chave PIX" : "Copiar Link"}>
                                                    <button
                                                        onClick={() => {
                                                            const key = charge.qr_code || charge.payment_link || '';
                                                            navigator.clipboard.writeText(key);
                                                            notify('success', 'Copiado', charge.qr_code ? 'Código PIX copiado!' : 'Link de pagamento copiado!');
                                                        }}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-400 hover:text-emerald-500 transition-colors"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Excluir Cobrança">
                                                    <button
                                                        onClick={() => handleDelete(charge)}
                                                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* NEW CHARGE MODAL */}
            <Modal
                isOpen={isModalOpen}
                onClose={resetForm}
                title="Novo Link de Pagamento"
                icon={CreditCard}
                maxWidth="max-w-2xl"
            >
                {!result ? (
                    <div className="space-y-4 py-2">
                        {approvedQuotes.length > 0 && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
                                <label className="block text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">Vincular a Orçamento Aprovado</label>
                                <select
                                    className="w-full bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900/50 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                                    value={selectedQuoteId}
                                    onChange={(e) => handleSelectQuote(e.target.value)}
                                >
                                    <option value="">Nenhum (Lançamento Avulso)</option>
                                    {approvedQuotes.map(q => (
                                        <option key={q.id} value={q.id}>
                                            {q.quote_number || q.id.slice(0, 8)} - {q.title} (R$ {q.total_amount})
                                        </option>
                                    ))}
                                </select>

                                {selectedQuoteId && charges.find(c => c.quote_id === selectedQuoteId && c.status === 'pending') && (
                                    <div className="mt-3 flex gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl animate-in fade-in slide-in-from-top-1">
                                        <AlertCircle className="text-red-500 flex-shrink-0" size={16} />
                                        <p className="text-[10px] text-red-600 dark:text-red-400">
                                            <strong>Bloqueado:</strong> Já existe uma cobrança pendente para este orçamento. Você deve excluí-la na lista principal antes de gerar uma nova.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
                                <select
                                    className="w-full bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500"
                                    value={selectedContactId}
                                    onChange={(e) => setSelectedContactId(e.target.value)}
                                >
                                    <option value="">Selecione um cliente...</option>
                                    {contacts.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <Input
                                label="Valor (R$)"
                                type="number"
                                placeholder="0,00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>

                        <Input
                            label="Descrição/Referência"
                            placeholder="Ex: Orçamento #123 ou Mensalidade"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />

                        <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-700">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Gateway de Saída</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedProvider('unified');
                                        setSelectedMethods(['pix', 'credit_card', 'boleto']);
                                    }}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedProvider === 'unified'
                                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-600'
                                        : 'border-transparent bg-white dark:bg-slate-800'
                                        }`}
                                >
                                    <Smartphone size={18} className={selectedProvider === 'unified' ? 'text-emerald-600' : 'text-gray-400'} />
                                    <div className="text-left">
                                        <span className="block text-sm font-bold dark:text-white">Checkout Único</span>
                                        <span className="text-[10px] text-gray-500 italic">Smart Link (PIX/Cartão/Boleto)</span>
                                    </div>
                                </button>
                                {activeGateways.map(gateway => (
                                    <button
                                        key={gateway.id}
                                        onClick={() => {
                                            setSelectedProvider(gateway.provider);
                                            setSelectedMethods([selectedMethods[0] || 'pix']);
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedProvider === gateway.provider
                                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-600'
                                            : 'border-transparent bg-white dark:bg-slate-800'
                                            }`}
                                    >
                                        <CreditCard size={18} className={selectedProvider === gateway.provider ? 'text-emerald-600' : 'text-gray-400'} />
                                        <div className="text-left">
                                            <span className="block text-sm font-bold capitalize dark:text-white">{gateway.provider.replace('_', ' ')}</span>
                                            <span className="text-[10px] text-gray-500">{gateway.is_sandbox ? 'TESTE/SANDBOX' : 'PRODUÇÃO'}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                            <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">Opções Disponíveis para o Cliente</label>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { id: 'pix', label: 'PIX', icon: QrCode },
                                    { id: 'credit_card', label: 'Cartão', icon: CreditCard },
                                    { id: 'boleto', label: 'Boleto', icon: FileText },
                                ].map((method) => (
                                    <button
                                        key={method.id}
                                        type="button"
                                        onClick={() => {
                                            if (selectedProvider === 'unified') {
                                                // Multi-select for unified
                                                setSelectedMethods(prev =>
                                                    prev.includes(method.id)
                                                        ? prev.filter(m => m !== method.id)
                                                        : [...prev, method.id]
                                                );
                                            } else {
                                                // Single-select for direct gateway
                                                setSelectedMethods([method.id]);
                                            }
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${selectedMethods.includes(method.id)
                                            ? 'border-emerald-500 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                                            : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400'
                                            }`}
                                    >
                                        <method.icon size={16} />
                                        <span className="text-sm font-bold">{method.label}</span>
                                    </button>
                                ))}
                            </div>
                            {selectedMethods.length === 0 && (
                                <p className="mt-2 text-[10px] text-amber-600">⚠️ Selecione ao menos um método para gerar o link.</p>
                            )}
                        </div>

                        {activeGateways.length === 0 && (
                            <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                                <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
                                <p className="text-xs text-amber-800 dark:text-amber-200">
                                    Nenhum gateway configurado ou ativo. Vá em <strong>Configurações {' > '} Pagamentos</strong> para ativar um.
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-6">
                            <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
                            <Button
                                onClick={handleCreate}
                                isLoading={creating}
                                disabled={activeGateways.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <RocketIcon size={18} className="mr-2" />
                                Gerar Link de Pagamento
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="py-6 text-center space-y-6">
                        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
                            <CheckCircle2 size={48} />
                        </div>
                        <div>
                            <h4 className="text-xl font-bold dark:text-white">Pagamento Gerado!</h4>
                            <p className="text-sm text-gray-500">Mande para o cliente e aguarde a conciliação.</p>
                        </div>

                        {result.qr_code_base64 ? (
                            <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-gray-100 inline-block">
                                <img
                                    src={`data:image/png;base64,${result.qr_code_base64}`}
                                    className="w-48 h-48 mx-auto"
                                    alt="PIX QR Code"
                                />
                                <p className="text-[10px] text-gray-400 mt-2 capitalize">QR Code gerado via {selectedProvider.replace('_', ' ')}</p>
                            </div>
                        ) : (
                            <div className="p-8 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 text-emerald-600/50">
                                <LinkIcon size={48} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm text-gray-500 font-medium">Link de Pagamento Gerado!</p>
                                <p className="text-[10px] text-gray-400">Pronto para envio (Cartão/Boleto)</p>
                            </div>
                        )}

                        <div className="space-y-3 max-w-sm mx-auto">
                            <Button
                                className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                onClick={() => {
                                    const key = result.qr_code || result.payment_link;
                                    navigator.clipboard.writeText(key);
                                    notify('success', 'Copiado', result.qr_code ? 'Código PIX copiado!' : 'Link copiado com sucesso!');
                                }}
                            >
                                <Copy size={18} className="mr-2" />
                                {result.qr_code ? 'Copiar Código PIX' : 'Copiar Link'}
                            </Button>
                            <Button variant="outline" className="w-full" onClick={resetForm}>
                                Fechar e Voltar
                            </Button>
                        </div>
                    </div>
                )
                }
            </Modal>

            {/* VIEW CHARGE DETAILS MODAL */}
            <Modal
                isOpen={!!viewingCharge}
                onClose={() => setViewingCharge(null)}
                title="Detalhes da Cobrança"
                icon={Search}
                maxWidth="max-w-md"
            >
                {viewingCharge && (
                    <div className="py-4 text-center space-y-6">
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(viewingCharge.amount)}
                            </span>
                            <span className="text-sm text-gray-500 mt-1">{viewingCharge.customer?.name}</span>
                        </div>

                        {viewingCharge.qr_code_base64 ? (
                            <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-gray-100 inline-block shadow-sm">
                                <img
                                    src={`data:image/png;base64,${viewingCharge.qr_code_base64}`}
                                    className="w-48 h-48 mx-auto"
                                    alt="PIX QR Code"
                                />
                                <p className="text-[10px] text-gray-400 mt-2">QR Code de Pagamento</p>
                            </div>
                        ) : (
                            <div className="p-8 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 text-gray-400">
                                <LinkIcon size={48} className="mx-auto mb-2 opacity-20" />
                                <p className="text-sm text-center font-medium">Link de Pagamento Ativo</p>
                                <p className="text-[10px] text-center mt-1">Copie o link abaixo para enviar ao cliente.</p>
                            </div>
                        )}

                        <div className="space-y-3">
                            {viewingCharge.qr_code && (
                                <Button
                                    className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                    onClick={() => {
                                        navigator.clipboard.writeText(viewingCharge.qr_code);
                                        notify('success', 'Copiado', 'Código PIX copiado!');
                                    }}
                                >
                                    <Copy size={18} className="mr-2" />
                                    Copiar Código PIX
                                </Button>
                            )}

                            {viewingCharge.payment_link && (
                                <a
                                    href={viewingCharge.payment_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block w-full"
                                >
                                    <Button variant="outline" className="w-full">
                                        <ExternalLink size={18} className="mr-2" />
                                        Abrir Link Externo
                                    </Button>
                                </a>
                            )}

                            {viewingCharge.is_sandbox && (
                                <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                                    ⚠️ <strong>Ambiente de Teste:</strong> Link externo pode exigir login em conta sandbox do Mercado Pago. Use o QR Code acima para validar.
                                </p>
                            )}

                            <Button variant="ghost" className="w-full" onClick={() => setViewingCharge(null)}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

function RocketIcon({ size, className }: { size: number, className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" />
            <path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" />
        </svg>
    );
}
