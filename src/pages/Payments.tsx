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
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { useCharges } from '../hooks/useCharges';
import { useContacts } from '../hooks/useContacts';
import { usePaymentGateways } from '../hooks/usePaymentGateways';
import { useQuotes } from '../hooks/useQuotes';
import { useNotification } from '../context/NotificationContext';
import { useEntity } from '../context/EntityContext';
import { formatCurrency } from '../utils/currencyUtils';
import { supabase } from '../lib/supabase';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { ResultModal } from '../components/ui/ResultModal';

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

    // Modal States
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [chargeToDelete, setChargeToDelete] = useState<any>(null);
    const [resultModal, setResultModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error'}>({
        isOpen: false, title: '', message: '', type: 'success'
    });

    // Form state
    const [selectedContactId, setSelectedContactId] = useState('');
    const [selectedQuoteId, setSelectedQuoteId] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('');
    const [selectedMethods, setSelectedMethods] = useState<string[]>(['pix', 'credit_card', 'boleto']);
    const [result, setResult] = useState<any>(null);
    const [viewingCharge, setViewingCharge] = useState<any>(null);
    const [selectedCurrency, setSelectedCurrency] = useState('BRL');

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
            { label: 'Total Recebido', value: new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(approved), color: 'emerald', icon: ArrowDownLeft },
            { label: 'Pendente', value: new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(pending), color: 'amber', icon: Clock },
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
                        currency: selectedCurrency,
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
                        currency: selectedCurrency,
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
        setChargeToDelete(charge);
        setDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!chargeToDelete) return;
        try {
            const res = await deleteCharge(chargeToDelete.id);
            setDeleteConfirmOpen(false);
            if (res.success) {
                setResultModal({
                    isOpen: true,
                    title: 'Sucesso',
                    message: 'Cobrança removida com sucesso.',
                    type: 'success'
                });
            } else {
                setResultModal({
                    isOpen: true,
                    title: 'Erro',
                    message: 'Falha ao remover cobrança.',
                    type: 'error'
                });
            }
        } catch (error) {
            setResultModal({
                isOpen: true,
                title: 'Erro',
                message: 'Erro de conexão ao excluir.',
                type: 'error'
            });
        } finally {
            setChargeToDelete(null);
        }
    };

    const resetForm = () => {
        setSelectedContactId('');
        setSelectedQuoteId('');
        setAmount('');
        setDescription('');
        setSelectedProvider(activeGateways[0]?.provider || 'unified');
        setSelectedMethods(['pix', 'credit_card', 'boleto']);
        setSelectedCurrency('BRL');
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
            if (quote.currency) setSelectedCurrency(quote.currency);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Faturamento</h1>
                    <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Gestão de links de pagamento e conciliação em tempo real.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 py-2.5 shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                        onClick={() => {
                            setSelectedProvider(activeGateways[0]?.provider || '');
                            setIsModalOpen(true);
                        }}
                    >
                        <Plus size={20} className="mr-2" />
                        <span className="font-bold uppercase tracking-wider text-xs">Novo Link de Pagamento</span>
                    </Button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-xl shadow-gray-200/40 dark:shadow-none transition-all duration-500 hover:shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className={`p-4 rounded-2xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400 group-hover:scale-110 transition-transform duration-500`}>
                                <stat.icon size={28} />
                            </div>
                        </div>
                        <h3 className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">{stat.label}</h3>
                        <p className="text-3xl font-black text-gray-900 dark:text-white mt-1 tabular-nums italic tracking-tighter">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* List Control */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-xl shadow-gray-200/30 dark:shadow-none overflow-hidden">
                <div className="p-6 border-b border-gray-50 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por cliente, descrição ou referência..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loadingCharges ? (
                        <div className="p-20 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Sincronizando transações...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-slate-800/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800">
                                    <th className="px-8 py-5">Cliente / Referência</th>
                                    <th className="px-8 py-5">Valor</th>
                                    <th className="px-8 py-5 text-center">Modo</th>
                                    <th className="px-8 py-5">Data</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                {filteredCharges.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-[2rem] mb-4">
                                                    <CreditCard size={40} className="text-gray-300 dark:text-slate-600" />
                                                </div>
                                                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Nenhuma transação encontrada</p>
                                                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Aguardando novo faturamento</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredCharges.map((charge) => (
                                        <tr key={charge.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all duration-300">
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">{charge.customer?.name || 'Cliente Geral'}</span>
                                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">{charge.external_reference}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="text-lg font-black text-gray-900 dark:text-white tabular-nums tracking-tighter italic">
                                                    {(() => {
                                                        const currencyCode = charge.currency || 'BRL';
                                                        const locale = currencyCode === 'BRL' ? 'pt-BR' : (currencyCode === 'USD' ? 'en-US' : (currencyCode === 'PYG' ? 'es-PY' : 'pt-BR'));
                                                        return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(charge.amount);
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`text-[9px] uppercase font-black tracking-widest px-2.5 py-1 rounded-lg border ${charge.is_sandbox
                                                    ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30'
                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30'
                                                    }`}>
                                                    {charge.is_sandbox ? 'Teste' : 'Prod'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                {new Date(charge.created_at).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                                                    charge.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900/30' :
                                                    charge.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30' :
                                                    'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/30'
                                                }`}>
                                                    {charge.status === 'approved' ? <CheckCircle2 size={12} /> :
                                                     charge.status === 'pending' ? <Clock size={12} /> :
                                                     <XCircle size={12} />}
                                                    {charge.status === 'approved' ? 'Pago' :
                                                     charge.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Tooltip content="Ver Detalhes">
                                                        <button
                                                            onClick={() => setViewingCharge(charge)}
                                                            className="p-2.5 bg-gray-50 dark:bg-slate-800 text-gray-400 hover:text-emerald-600 rounded-xl transition-all shadow-sm"
                                                        >
                                                            <Search size={16} />
                                                        </button>
                                                    </Tooltip>
                                                    {charge.payment_link && (
                                                        <Tooltip content="Abrir Link">
                                                            <a
                                                                href={charge.payment_link}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl hover:bg-blue-100 transition-all shadow-sm"
                                                            >
                                                                <ExternalLink size={16} />
                                                            </a>
                                                        </Tooltip>
                                                    )}
                                                    <Tooltip content="Copiar Link/PIX">
                                                        <button
                                                            onClick={() => {
                                                                const key = charge.qr_code || charge.payment_link || '';
                                                                navigator.clipboard.writeText(key);
                                                                notify('success', 'Copiado', charge.qr_code ? 'Código PIX copiado!' : 'Link de pagamento copiado!');
                                                            }}
                                                            className="p-2.5 bg-gray-50 dark:bg-slate-800 text-gray-400 hover:text-amber-600 rounded-xl transition-all shadow-sm"
                                                        >
                                                            <Copy size={16} />
                                                        </button>
                                                    </Tooltip>
                                                    <Tooltip content="Excluir">
                                                        <button
                                                            onClick={() => handleDelete(charge)}
                                                            className="p-2.5 bg-rose-50 dark:bg-rose-900/20 text-rose-400 hover:text-rose-600 rounded-xl transition-all shadow-sm"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
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
                    <div className="space-y-6 py-4">
                        {approvedQuotes.length > 0 && (
                            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-[2rem] transition-all">
                                <label className="block text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-4">Vincular a Orçamento Aprovado</label>
                                <select
                                    className="w-full bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                                    value={selectedQuoteId}
                                    onChange={(e) => handleSelectQuote(e.target.value)}
                                >
                                    <option value="">Nenhum (Lançamento Avulso)</option>
                                    {approvedQuotes.map(q => (
                                        <option key={q.id} value={q.id}>
                                            #{q.quote_number || q.id.slice(0, 8)} - {q.title} ({formatCurrency(q.total_amount)})
                                        </option>
                                    ))}
                                </select>

                                {selectedQuoteId && charges.find(c => c.quote_id === selectedQuoteId && c.status === 'pending') && (
                                    <div className="mt-4 flex gap-3 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl animate-in fade-in slide-in-from-top-2">
                                        <AlertCircle className="text-rose-500 flex-shrink-0" size={18} />
                                        <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide leading-relaxed">
                                            Já existe uma cobrança pendente para este orçamento. Exclua a anterior antes de gerar uma nova.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cliente Beneficiário</label>
                                <select
                                    className="w-full bg-gray-50 dark:bg-slate-800 border-transparent rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                                    value={selectedContactId}
                                    onChange={(e) => setSelectedContactId(e.target.value)}
                                >
                                    <option value="">Selecione um cliente...</option>
                                    {contacts.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Moeda do Link</label>
                                <select
                                    className="w-full bg-gray-50 dark:bg-slate-800 border-transparent rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 transition-all appearance-none cursor-pointer"
                                    value={selectedCurrency}
                                    onChange={(e) => setSelectedCurrency(e.target.value)}
                                >
                                    <option value="BRL">Real (R$)</option>
                                    <option value="USD">Dólar ($)</option>
                                    <option value="EUR">Euro (€)</option>
                                    <option value="PYG">Guarani (Gs.)</option>
                                    <option value="ARS">Peso Arg ($)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="md:col-span-1">
                                <CurrencyInput
                                    label="Valor da Cobrança"
                                    placeholder="0,00"
                                    value={Number(amount)}
                                    onChange={(num: number) => setAmount(num.toString())}
                                />
                            </div>
                            <div className="md:col-span-1">
                                <Input
                                    label="Referência Externa"
                                    placeholder="Ex: Pedido #1234"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Gateway Selection */}
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Processador de Pagamento</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        setSelectedProvider('unified');
                                        setSelectedMethods(['pix', 'credit_card', 'boleto']);
                                    }}
                                    className={`group flex items-center gap-4 p-5 rounded-3xl border-2 transition-all ${selectedProvider === 'unified'
                                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-lg shadow-emerald-500/10'
                                        : 'border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-gray-200'
                                        }`}
                                >
                                    <div className={`p-3 rounded-2xl transition-colors ${selectedProvider === 'unified' ? 'bg-white text-emerald-600' : 'bg-gray-50 dark:bg-slate-800 text-gray-400'}`}>
                                        <Smartphone size={24} />
                                    </div>
                                    <div className="text-left">
                                        <span className="block text-sm font-black dark:text-white uppercase tracking-tight leading-none">Checkout Único</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mt-1 tracking-widest">Smart Link (Global)</span>
                                    </div>
                                </button>
                                {activeGateways.map(gateway => (
                                    <button
                                        key={gateway.id}
                                        onClick={() => {
                                            setSelectedProvider(gateway.provider);
                                            setSelectedMethods([selectedMethods[0] || 'pix']);
                                        }}
                                        className={`group flex items-center gap-4 p-5 rounded-3xl border-2 transition-all ${selectedProvider === gateway.provider
                                            ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-lg shadow-emerald-500/10'
                                            : 'border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-gray-200'
                                            }`}
                                    >
                                        <div className={`p-3 rounded-2xl transition-colors ${selectedProvider === gateway.provider ? 'bg-white text-emerald-600' : 'bg-gray-50 dark:bg-slate-800 text-gray-400'}`}>
                                            <CreditCard size={24} />
                                        </div>
                                        <div className="text-left">
                                            <span className="block text-sm font-black dark:text-white uppercase tracking-tight leading-none">{gateway.provider.replace('_', ' ')}</span>
                                            <span className={`text-[9px] font-black uppercase mt-1 tracking-[0.2em] ${gateway.is_sandbox ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {gateway.is_sandbox ? 'Sandbox' : 'Produção'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 transition-all">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 text-center">Métodos Aceitos</label>
                            <div className="flex flex-wrap justify-center gap-4">
                                {[
                                    { id: 'pix', label: 'PIX Instantâneo', icon: QrCode },
                                    { id: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard },
                                    { id: 'boleto', label: 'Boleto Bancário', icon: FileText },
                                ].map((method) => (
                                    <button
                                        key={method.id}
                                        type="button"
                                        onClick={() => {
                                            if (selectedProvider === 'unified') {
                                                setSelectedMethods(prev =>
                                                    prev.includes(method.id)
                                                        ? prev.filter(m => m !== method.id)
                                                        : [...prev, method.id]
                                                );
                                            } else {
                                                setSelectedMethods([method.id]);
                                            }
                                        }}
                                        className={`flex flex-col items-center gap-3 px-6 py-4 rounded-3xl border-2 transition-all duration-300 min-w-[120px] ${selectedMethods.includes(method.id)
                                            ? 'border-emerald-500 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xl shadow-emerald-500/5'
                                            : 'border-transparent bg-gray-100 dark:bg-slate-800 text-gray-400 grayscale opacity-60'
                                            }`}
                                    >
                                        <method.icon size={24} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{method.label.split(' ')[0]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pt-8">
                            <Button variant="ghost" className="rounded-xl px-8 font-bold uppercase tracking-widest text-xs" onClick={resetForm}>Cancelar</Button>
                            <Button
                                onClick={handleCreate}
                                isLoading={creating}
                                disabled={activeGateways.length === 0 || selectedMethods.length === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-10 py-3 shadow-xl shadow-emerald-500/20 font-black uppercase tracking-widest text-xs"
                            >
                                <RocketIcon size={18} className="mr-2" />
                                Lançar Cobrança
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center space-y-8 animate-in zoom-in-95 duration-500">
                        <div className="relative inline-block">
                            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-[2.5rem] flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
                                <CheckCircle2 size={48} />
                            </div>
                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-gray-100 dark:border-slate-700">
                                <CreditCard size={16} className="text-emerald-500" />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <h4 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Link Gerado!</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">A cobrança foi registrada e está pronta para envio.</p>
                        </div>

                        <div className="max-w-xs mx-auto p-2 bg-gray-50 dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 overflow-hidden shadow-inner">
                            {result.qr_code_base64 ? (
                                <div className="bg-white p-6 rounded-[2rem] shadow-sm">
                                    <img
                                        src={`data:image/png;base64,${result.qr_code_base64}`}
                                        className="w-48 h-48 mx-auto"
                                        alt="PIX QR Code"
                                    />
                                    <div className="mt-4 pt-4 border-t border-gray-50">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">QR Code via {selectedProvider.replace('_', ' ')}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-12 bg-white dark:bg-slate-800 rounded-[2rem] text-emerald-600/30 shadow-sm border border-gray-50 dark:border-slate-700">
                                    <LinkIcon size={64} className="mx-auto mb-4 opacity-50" />
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Link Externo Ativo</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 max-w-sm mx-auto pt-4">
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-4 shadow-xl shadow-emerald-500/20 font-black uppercase tracking-widest text-xs"
                                onClick={() => {
                                    const key = result.qr_code || result.payment_link;
                                    navigator.clipboard.writeText(key);
                                    notify('success', 'Copiado', result.qr_code ? 'Código PIX copiado!' : 'Link copiado com sucesso!');
                                }}
                            >
                                <Copy size={18} className="mr-2" />
                                {result.qr_code ? 'Copiar Chave PIX' : 'Copiar Link'}
                            </Button>
                            <Button variant="ghost" className="w-full font-bold uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600" onClick={resetForm}>
                                Voltar para a Lista
                            </Button>
                        </div>
                    </div>
                )}
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
                    <div className="py-6 text-center space-y-8 animate-in fade-in duration-500">
                        <div className="flex flex-col items-center">
                            <span className="text-4xl font-black text-gray-900 dark:text-white italic tracking-tighter tabular-nums">
                                {(() => {
                                    const currencyCode = viewingCharge.currency || 'BRL';
                                    const locale = currencyCode === 'BRL' ? 'pt-BR' : (currencyCode === 'USD' ? 'en-US' : (currencyCode === 'PYG' ? 'es-PY' : 'pt-BR'));
                                    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(viewingCharge.amount);
                                })()}
                            </span>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{viewingCharge.customer?.name || 'Cliente Geral'}</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${
                                    viewingCharge.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                    viewingCharge.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                    'bg-rose-50 text-rose-600 border-rose-100'
                                }`}>
                                    {viewingCharge.status === 'approved' ? 'Pago' : viewingCharge.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                </span>
                            </div>
                        </div>

                        <div className="max-w-[280px] mx-auto p-2 bg-gray-50 dark:bg-slate-900 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-inner">
                            {viewingCharge.qr_code_base64 ? (
                                <div className="bg-white p-6 rounded-[2rem] shadow-sm">
                                    <img
                                        src={`data:image/png;base64,${viewingCharge.qr_code_base64}`}
                                        className="w-48 h-48 mx-auto"
                                        alt="PIX QR Code"
                                    />
                                    <div className="mt-4 pt-4 border-t border-gray-50">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest italic text-center">QR Code PIX Ativo</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-16 bg-white dark:bg-slate-800 rounded-[2rem] text-gray-200 dark:text-slate-700 shadow-sm border border-gray-50 dark:border-slate-800">
                                    <LinkIcon size={64} className="mx-auto mb-4 opacity-50" />
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic text-center">Checkout Externo</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4 pt-4">
                            {viewingCharge.qr_code && (
                                <Button
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-4 shadow-xl shadow-emerald-500/20 font-black uppercase tracking-widest text-xs"
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
                                    <Button variant="outline" className="w-full rounded-2xl py-4 font-black uppercase tracking-widest text-xs border-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all">
                                        <ExternalLink size={18} className="mr-2" />
                                        Abrir no Navegador
                                    </Button>
                                </a>
                            )}

                            {viewingCharge.is_sandbox && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl">
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide leading-relaxed text-center">
                                        ⚠️ <strong>Ambiente de Teste:</strong> Link externo pode exigir login em conta sandbox.
                                    </p>
                                </div>
                            )}

                            <Button variant="ghost" className="w-full font-bold uppercase tracking-widest text-[10px] text-gray-400 hover:text-gray-600 pt-4" onClick={() => setViewingCharge(null)}>
                                Fechar Detalhes
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmationModal
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={executeDelete}
                title="Excluir Cobrança"
                message={`Tem certeza que deseja excluir a cobrança de ${chargeToDelete?.customer?.name}? Esta ação não pode ser desfeita.`}
                variant="danger"
                confirmLabel="Sim, Excluir"
            />

            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
            />
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
