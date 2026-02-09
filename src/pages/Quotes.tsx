import { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, Check, X, Printer, Trash2, Edit, Calendar, AlertTriangle, Send, Loader2, CalendarClock, CreditCard, Copy, Rocket } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useQuotes, type Quote } from '../hooks/useQuotes';
import { useNavigate, useLocation } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';

import { SettleModal } from '../components/transactions/SettleModal';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { useTeam } from '../hooks/useTeam';
import { useCharges } from '../hooks/useCharges';
import { usePaymentGateways } from '../hooks/usePaymentGateways';
import { useNotification } from '../context/NotificationContext';
import { webhookService } from '../services/webhookService';
import { fiscalService } from '../services/fiscalService';
import { supabase } from '../lib/supabase';

export function Quotes() {
    const navigate = useNavigate();
    const location = useLocation();
    const { quotes, loading, deleteQuote, updateQuoteStatus, approveQuote, resetQuotePayment, scheduleFollowUp } = useQuotes();
    const { createCharge, charges } = useCharges();
    const { gateways } = usePaymentGateways();
    const { notify } = useNotification();
    const [isGeneratingPayment, setIsGeneratingPayment] = useState<string | null>(null);
    const [paymentResult, setPaymentResult] = useState<any>(null);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [waInstances, setWaInstances] = useState<any[]>([]);

    // Permission Check
    const { user } = useAuth();
    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const { members } = useTeam();
    const currentCompany = companies.find(c => c.id === currentEntity.id);

    useEffect(() => {
        const fetchWA = async () => {
            const { data } = await supabase
                .from('instances')
                .select('*')
                .eq('status', 'connected');

            if (currentEntity.type === 'company' && currentEntity.id) {
                setWaInstances(data?.filter(i => i.company_id === currentEntity.id) || []);
            } else {
                setWaInstances(data?.filter(i => i.user_id === user?.id && !i.company_id) || []);
            }
        };
        fetchWA();
    }, [currentEntity.id, user?.id]);

    const handleSendWhatsApp = async (quote: Quote, result: any) => {
        const instance = waInstances[0];
        if (!instance) {
            notify('warning', 'Atenção', 'Nenhuma instância de WhatsApp conectada para envio automático.');
            return;
        }

        const phone = quote.contact?.phone?.replace(/\D/g, '');
        if (!phone) {
            notify('warning', 'Atenção', 'Cliente não possui telefone cadastrado.');
            return;
        }

        setIsSendingWhatsApp(true);
        try {
            const message = `Olá, ${quote.contact?.name || 'cliente'}! Segue o link para pagamento do seu orçamento:\n\n🔗 ${result.payment_link}\n\nObrigado pela confiança!`;

            const response = await fetch('http://localhost:3001/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instanceName: instance.instance_name,
                    number: phone,
                    text: message
                })
            });

            if (response.ok) {
                notify('success', 'Sucesso', 'Mensagem enviada via WhatsApp!');
            } else {
                const err = await response.json();
                notify('error', 'Erro', err.detail?.message || 'Falha ao enviar mensagem.');
            }
        } catch (err) {
            notify('error', 'Erro', 'Erro de conexão com o servidor de WhatsApp.');
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    // ... (existing code)

    const handleOpenRecovery = (quote: Quote) => {
        setRecoveryQuote(quote);
        if (quote.follow_up_date) {
            setRecoveryDate(quote.follow_up_date);
            setRecoveryNotes(quote.negotiation_notes || '');
        } else {
            // Default date: 30 days from now
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 30);
            setRecoveryDate(defaultDate.toISOString().split('T')[0]);
            setRecoveryNotes('');
        }
        setShowRecoveryModal(true);
    };

    const handleScheduleFollowUp = async () => {
        if (!recoveryQuote || !recoveryDate) return;

        try {
            await scheduleFollowUp(recoveryQuote.id, recoveryDate, recoveryNotes);
            setShowRecoveryModal(false);
            setRecoveryQuote(null);
            alert('✅ Retorno agendado com sucesso!');
        } catch (error) {
            console.error('Error scheduling follow-up:', error);
            alert('Erro ao agendar retorno.');
        }
    };



    let canDelete = true;
    if (currentEntity.type === 'company' && user) {
        const company = companies.find(c => c.id === currentEntity.id);
        const myMembership = members.find(m => m.user_id === user.id);

        const isOwnerOrAdmin = myMembership?.role === 'owner' || myMembership?.role === 'admin';
        const memberCanDelete = company?.settings?.member_can_delete ?? false;

        if (!isOwnerOrAdmin && !memberCanDelete) {
            canDelete = false;
        }
    }

    // State for sending proposal
    const [sendingProposal, setSendingProposal] = useState<string | null>(null);

    // Helper to get local date ISO string YYYY-MM-DD
    const getLocalDateISO = (date: Date = new Date()) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    // Default to today (Local Time)
    const today = getLocalDateISO();

    // Default end date to tomorrow (Local Time)
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = getLocalDateISO(tomorrowDate);

    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(tomorrow);
    const [showAll, setShowAll] = useState(() => {
        const saved = sessionStorage.getItem('quotes_show_all');
        return saved === 'true';
    });

    // Persist showAll state
    useEffect(() => {
        sessionStorage.setItem('quotes_show_all', showAll.toString());
    }, [showAll]);

    // Modals state
    const [quoteToApprove, setQuoteToApprove] = useState<Quote | null>(null);
    const [showApprovalOptions, setShowApprovalOptions] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);

    // Recovery Modal State
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [recoveryQuote, setRecoveryQuote] = useState<Quote | null>(null);
    const [recoveryDate, setRecoveryDate] = useState('');
    const [recoveryNotes, setRecoveryNotes] = useState('');

    // Fiscal Emission State
    const [isEmittingFiscal, setIsEmittingFiscal] = useState<string | null>(null);
    const [showFiscalModal, setShowFiscalModal] = useState(false);
    const [fiscalStatus, setFiscalStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ status: 'idle' });

    // Finalize Recovery Modal
    const [showFinalizeModal, setShowFinalizeModal] = useState(false);
    const [finalizeQuote, setFinalizeQuote] = useState<Quote | null>(null);

    const statusColors = {
        draft: 'bg-gray-100 text-gray-800',
        sent: 'bg-blue-100 text-blue-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        cancelled: 'bg-gray-400 text-white',
    };

    const statusLabels = {
        draft: 'Rascunho',
        sent: 'Enviado',
        approved: 'Aprovado',
        rejected: 'Rejeitado',
        cancelled: 'Perdido',
    };

    const handleDelete = async (quote: Quote) => {
        if (!canDelete) {
            alert('Você não tem permissão para excluir orçamentos.');
            return;
        }

        // 🔓 SUPER ADMIN: Bypass all protections
        const isSuperAdmin = user?.email === 'carloscleton.nat@gmail.com';

        if (!isSuperAdmin) {
            // 🔒 Check if quote is protected (only for non-super-admins)
            if (quote.status === 'approved' && (quote.payment_status === 'pending' || quote.payment_status === 'paid')) {
                alert('🔒 Não é possível excluir orçamentos aprovados com pagamento associado.\n\nEsta é uma medida de segurança para proteger dados financeiros.');
                return;
            }
        }

        let message = 'Tem certeza que deseja excluir este orçamento?';

        if (quote.status === 'approved' || quote.payment_status === 'paid' || quote.payment_status === 'pending') {
            message = '⚠️ ATENÇÃO: Este orçamento tem um lançamento financeiro associado.\n\nAo excluir este orçamento, o lançamento em "A Receber" (ou "Recebido") TAMBÉM SERÁ EXCLUÍDO permanentemente.\n\nDeseja continuar?';
        }

        if (confirm(message)) {
            try {
                await deleteQuote(quote.id);
            } catch (error: any) {
                alert(error.message || 'Erro ao excluir orçamento');
            }
        }
    };

    const handleApproveClick = (quote: Quote) => {
        setQuoteToApprove(quote);
        setShowApprovalOptions(true);
    };

    const handleJustApprove = async () => {
        if (!quoteToApprove) return;
        await approveQuote(quoteToApprove.id, { generateTransaction: false });
        closeModals();
    };

    const handleApprovePending = async () => {
        if (!quoteToApprove) return;
        await approveQuote(quoteToApprove.id, { generateTransaction: true, transactionStatus: 'pending' });
        closeModals();
    };

    const handleApproveReceive = () => {
        setShowApprovalOptions(false);
        setShowSettleModal(true);
    };

    const handleSettleConfirm = async (date: string, paymentMethod: string, interest: number, penalty: number, totalAmount: number) => {
        if (!quoteToApprove) return;
        await approveQuote(quoteToApprove.id, {
            generateTransaction: true,
            transactionStatus: 'received',
            paymentDetails: {
                date,
                method: paymentMethod,
                interest,
                penalty,
                amount: totalAmount
            }
        });
        closeModals();
    };

    const handleResetPayment = async (quote: Quote) => {
        if (!confirm('Deseja cancelar o recebimento deste orçamento e voltá-lo para "Aguardando Pagamento"?\n\nIsso limpará os dados de data e forma de pagamento no financeiro.')) return;

        const { error } = await resetQuotePayment(quote.id);
        if (error) {
            alert('Erro ao resetar: ' + error);
        } else {
            alert('Status resetado com sucesso! O orçamento voltou para "Aguardando Pagamento".');
        }
    };

    const closeModals = () => {
        setQuoteToApprove(null);
        setShowApprovalOptions(false);
        setShowSettleModal(false);
        setShowFinalizeModal(false);
        setFinalizeQuote(null);
    };

    const handleFinalizeClick = (quote: Quote) => {
        setFinalizeQuote(quote);
        setShowFinalizeModal(true);
    };

    const handleRecoverySuccess = async () => {
        if (!finalizeQuote) return;
        try {
            // Generate a pending transaction so it appears in "Accounts Receivable"
            await approveQuote(finalizeQuote.id, {
                generateTransaction: true,
                transactionStatus: 'pending'
            });
            await scheduleFollowUp(finalizeQuote.id, null as any, finalizeQuote.negotiation_notes || '');

            setShowFinalizeModal(false);
            setFinalizeQuote(null);
            alert('✅ Recuperação realizada com sucesso! Gerado contas a receber (Pendente).');
        } catch (err) {
            console.error(err);
            alert('Erro ao finalizar recuperação.');
        }
    };

    const handleRecoveryFailure = async () => {
        if (!finalizeQuote) return;
        try {
            // Update status to 'cancelled' (Lost) to remove from stats
            await updateQuoteStatus(finalizeQuote.id, 'cancelled');
            // Remove follow up
            await scheduleFollowUp(finalizeQuote.id, null as any, finalizeQuote.negotiation_notes || '');

            setShowFinalizeModal(false);
            setFinalizeQuote(null);
            alert('Recuperação finalizada. Orçamento marcado como Perdido.');
        } catch (err) {
            console.error(err);
            alert('Erro ao finalizar.');
        }
    };

    const handleEmitFiscal = async (quote: Quote) => {
        if (!currentEntity.id) return;

        setIsEmittingFiscal(quote.id);
        setFiscalStatus({ status: 'loading', message: 'Preparando dados para o SEFAZ...' });
        setShowFiscalModal(true);

        try {
            if (!currentCompany || !currentCompany.tecnospeed_config) {
                throw new Error('Configurações fiscais da empresa não encontradas.');
            }

            // Fetch full quote details
            const { data: fullQuote, error: quoteError } = await supabase
                .from('quotes')
                .select('*, items:quote_items(*), contact:contact_id(*)')
                .eq('id', quote.id)
                .single();

            if (quoteError || !fullQuote) throw new Error('Erro ao buscar itens do orçamento.');

            // 1. Detect if it is Service or Product
            const isServiceOnly = fullQuote.items.every((item: any) => item.service_id);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada. Faça login novamente.');

            let result;

            if (isServiceOnly) {
                // Map to PlugNotas format (NFS-e)
                const payload = {
                    idIntegracao: fullQuote.id,
                    prestador: {
                        cpfCnpj: currentCompany.cnpj?.replace(/\D/g, '') || currentCompany.tecnospeed_config?.cnpj?.replace(/\D/g, '')
                    },
                    tomador: {
                        cpfCnpj: fullQuote.contact?.tax_id?.replace(/\D/g, ''),
                        razaoSocial: fullQuote.contact?.name,
                        email: fullQuote.contact?.email,
                        endereco: {
                            logradouro: fullQuote.contact?.street || '',
                            numero: fullQuote.contact?.number || 'S/N',
                            bairro: fullQuote.contact?.neighborhood || '',
                            cep: fullQuote.contact?.zip_code?.replace(/\D/g, ''),
                            codigoCidade: '', // PlugNotas resolve via nome/uf se vazio? Melhor enviar se tiver.
                            uf: fullQuote.contact?.state || ''
                        }
                    },
                    servico: fullQuote.items.map((item: any) => ({
                        codigo: item.codigo_servico_municipal || '001',
                        descricao: item.description,
                        valorUnitario: item.unit_price,
                        quantidade: item.quantity,
                        itemListaServico: item.item_lista_servico || '01.01'
                    }))
                };

                setFiscalStatus({ status: 'loading', message: 'Enviando NFS-e (Serviços)...' });
                result = await fiscalService.emitirNFSe(currentEntity.id, payload, token);
            } else {
                // Map to PlugNotas format (NF-e - Products)
                const payload = {
                    idIntegracao: fullQuote.id,
                    presenca: 1,
                    natureza: 'Venda de Mercadoria',
                    itens: fullQuote.items.map((item: any) => ({
                        codigo: item.service_id || item.product_id || '001',
                        descricao: item.description,
                        ncm: item.ncm || '00000000',
                        cest: item.cest || '',
                        cfop: item.service_id ? '5933' : '5102', // 5933 para servico em NFe
                        valorUnitario: { comercial: item.unit_price },
                        quantidade: { comercial: item.quantity },
                        unidade: { comercial: 'UN' },
                        tributos: {
                            icms: { origem: item.origem?.toString() || '0', cst: '00', aliquota: 0 },
                            pis: { cst: '07' },
                            cofins: { cst: '07' }
                        }
                    })),
                    pagamentos: [
                        {
                            meio: '90',
                            valor: fullQuote.total_amount
                        }
                    ]
                };

                setFiscalStatus({ status: 'loading', message: 'Enviando NF-e (Produtos)...' });
                result = await fiscalService.emitirNFe(currentEntity.id, payload, token);
            }

            setFiscalStatus({
                status: 'success',
                message: `Nota enviada com sucesso! ID: ${result.data?.id || 'Pendente'}`
            });

            // Update quote with NFe ID
            if (result.data?.id) {
                await supabase.from('quotes').update({
                    nfe_id: result.data.id,
                    nfe_status: 'processando'
                }).eq('id', quote.id);
            }

        } catch (error: any) {
            console.error('Erro fiscal:', error);
            setFiscalStatus({
                status: 'error',
                message: error.response?.data?.error || error.message || 'Erro desconhecido na emissão.'
            });
        } finally {
            setIsEmittingFiscal(null);
        }
    };

    // View Mode: 'default' | 'recovery'
    const [viewMode, setViewMode] = useState<'default' | 'recovery'>(
        (location.state as any)?.viewMode === 'recovery' ? 'recovery' : 'default'
    );

    const filteredQuotes = useMemo(() => {
        if (viewMode === 'recovery') {
            return quotes.filter(quote => quote.status === 'rejected' && quote.follow_up_date);
        }

        if (showAll) return quotes;
        return quotes.filter(quote => {
            // If filtering by date, we exclude those that surely not match, but usually we filter by created_at
            const quoteDate = new Date(quote.created_at).toISOString().split('T')[0];
            return quoteDate >= startDate && quoteDate <= endDate;
        });
    }, [quotes, startDate, endDate, showAll, viewMode]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const { totalValue, totalDiscount } = useMemo(() => {
        return filteredQuotes.reduce((acc, quote) => {
            const amount = quote.total_amount || 0;
            let discount = 0;

            if (quote.discount && quote.discount > 0) {
                if (quote.discount_type === 'percentage') {
                    // Calculate absolute discount value from the Net Total
                    // Net = Gross * (1 - rate)
                    // Gross = Net / (1 - rate)
                    // Discount = Gross * rate
                    discount = (amount / (1 - (quote.discount / 100))) * (quote.discount / 100);
                } else {
                    discount = quote.discount;
                }
            }

            return {
                totalValue: acc.totalValue + amount,
                totalDiscount: acc.totalDiscount + discount
            };
        }, { totalValue: 0, totalDiscount: 0 });
    }, [filteredQuotes]);

    const getDiscountDisplay = (quote: Quote) => {
        if (!quote.discount || quote.discount === 0) return '-';

        if (quote.discount_type === 'percentage') {
            const discountValue = (quote.total_amount || 0) / (1 - ((quote.discount || 0) / 100)) * (quote.discount / 100);
            return `${quote.discount}% (${formatCurrency(discountValue)})`;
        }

        return formatCurrency(quote.discount);
    };

    const validatePaymentRequirements = (quote: Quote) => {
        const missing = [];
        if (!quote.contact?.tax_id) missing.push('CPF/CNPJ do Cliente');
        if (!quote.contact?.phone) missing.push('Telefone do Cliente');
        if (!quote.contact?.address?.street) missing.push('Endereço (Rua)');
        if (!quote.contact?.address?.number) missing.push('Número do Endereço');

        if (missing.length > 0) {
            alert(`⚠️ Para gerar o link de pagamento, complete o cadastro do cliente:\n\nFaltando:\n- ${missing.join('\n- ')}`);
            return false;
        }
        return true;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orçamentos</h1>
                    <p className="text-gray-500 dark:text-gray-400">Gerencie e emita propostas comerciais.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <Button onClick={() => navigate('/quotes/new')}>
                        <Plus size={20} className="mr-2" />
                        Novo Orçamento
                    </Button>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 mb-4">
                <button
                    onClick={() => setViewMode('default')}
                    className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${viewMode === 'default'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Todos os Orçamentos
                </button>
                <button
                    onClick={() => setViewMode('recovery')}
                    className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${viewMode === 'recovery'
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <CalendarClock size={16} />
                    Recuperação
                </button>
            </div>

            {/* Filter Bar */}
            {viewMode === 'default' && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-gray-200 dark:border-slate-700 flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[300px] flex gap-4">
                        <div className="flex-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Data Inicial</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-3 text-gray-400" />
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setShowAll(false);
                                    }}
                                    className="pl-10"
                                    disabled={showAll}
                                />
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Data Final</label>
                            <div className="relative">
                                <Calendar size={16} className="absolute left-3 top-3 text-gray-400" />
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setShowAll(false);
                                    }}
                                    className="pl-10"
                                    disabled={showAll}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                        <input
                            type="checkbox"
                            id="showAll"
                            checked={showAll}
                            onChange={(e) => setShowAll(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="showAll" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            Mostrar todos
                        </label>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-10 text-gray-500">Carregando...</div>
            ) : filteredQuotes.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700">
                    <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Nenhum orçamento encontrado</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                        {showAll ? "Puxa, você ainda não criou nenhum orçamento." : "Nenhum orçamento para o período selecionado."}
                    </p>
                    {showAll && (
                        <Button onClick={() => navigate('/quotes/new')}>
                            <Plus size={20} className="mr-2" />
                            Criar Orçamento
                        </Button>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Resp.</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Título</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Desconto</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Valor Total</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                {filteredQuotes.map((quote) => (
                                    <tr key={quote.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                            {new Date(quote.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">
                                            {quote.contact?.name || 'Cliente não inf.'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                            {members.find(m => m.user_id === quote.user_id)?.profile.full_name.split(' ')[0] || '-'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={quote.title}>
                                            {quote.title}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-red-500 font-medium text-right whitespace-nowrap">
                                            {getDiscountDisplay(quote)}
                                        </td>
                                        <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white text-right whitespace-nowrap">
                                            {formatCurrency(quote.total_amount)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[quote.status]}`}>
                                                    {statusLabels[quote.status]}
                                                </span>
                                                {quote.status === 'approved' && quote.payment_status === 'pending' && (
                                                    <span className="flex items-center text-[10px] text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800" title="Pagamento Pendente">
                                                        <AlertTriangle size={10} className="mr-1" />
                                                        Aguardando Pagto
                                                    </span>
                                                )}
                                                {quote.status === 'approved' && quote.payment_status === 'paid' && (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="flex items-center text-[10px] text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800" title="Pagamento Realizado">
                                                            <Check size={10} className="mr-1" />
                                                            Pago
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleResetPayment(quote);
                                                            }}
                                                            className="text-[9px] text-gray-500 hover:text-red-500 underline"
                                                        >
                                                            Resetar
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Follow-up Indicator */}
                                                {quote.follow_up_date && (
                                                    <Tooltip content={quote.negotiation_notes || "Retorno Agendado"}>
                                                        <span className={`flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border mt-1 ${new Date(quote.follow_up_date) < new Date()
                                                            ? 'text-red-600 bg-red-50 border-red-200'
                                                            : 'text-blue-600 bg-blue-50 border-blue-200'
                                                            }`}>
                                                            <CalendarClock size={10} className="mr-1" />
                                                            {quote.follow_up_date.split('-').reverse().join('/')}
                                                        </span>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Status Actions */}
                                                {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'approved') && (
                                                    <Tooltip content={quote.status === 'draft' ? 'Enviar Proposta' : 'Reenviar Proposta'}>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    setSendingProposal(quote.id);

                                                                    // Only update status if it's draft
                                                                    if (quote.status === 'draft') {
                                                                        await updateQuoteStatus(quote.id, 'sent');
                                                                    }

                                                                    // Fetch complete quote data with items and customer
                                                                    const { data: fullQuote, error: quoteError } = await supabase
                                                                        .from('quotes')
                                                                        .select(`
                                                                            *,
                                                                            contact:contact_id(*),
                                                                            items:quote_items(*)
                                                                        `)
                                                                        .eq('id', quote.id)
                                                                        .single();

                                                                    if (quoteError) throw quoteError;

                                                                    // Get company data
                                                                    const { data: companyData } = await supabase
                                                                        .from('companies')
                                                                        .select('*')
                                                                        .eq('id', currentEntity.id)
                                                                        .single();

                                                                    // Calculate totals
                                                                    const subtotal = fullQuote.items?.reduce((sum: number, item: any) =>
                                                                        sum + item.total_price, 0) || 0;

                                                                    const discountAmount = fullQuote.discount_type === 'percentage'
                                                                        ? (subtotal * fullQuote.discount) / 100
                                                                        : fullQuote.discount;

                                                                    const total = subtotal - discountAmount;

                                                                    // Generate and upload PDF
                                                                    console.log('📄 Generating PDF for quote:', quote.id);
                                                                    const { PDFService } = await import('../services/pdfService');

                                                                    const pdfUrl = await PDFService.generateAndUploadQuotePDF({
                                                                        quote: {
                                                                            id: fullQuote.id,
                                                                            title: fullQuote.title,
                                                                            created_at: fullQuote.created_at,
                                                                            valid_until: fullQuote.valid_until,
                                                                            status: fullQuote.status,
                                                                            discount: fullQuote.discount || 0,
                                                                            discount_type: fullQuote.discount_type || 'amount',
                                                                            notes: fullQuote.notes
                                                                        },
                                                                        customer: {
                                                                            name: fullQuote.contact?.name || 'Cliente',
                                                                            email: fullQuote.contact?.email,
                                                                            phone: fullQuote.contact?.phone,
                                                                            address: fullQuote.contact?.address
                                                                        },
                                                                        items: fullQuote.items || [],
                                                                        company: {
                                                                            name: companyData?.name || 'Empresa',
                                                                            email: companyData?.email,
                                                                            phone: companyData?.phone,
                                                                            address: companyData?.address
                                                                        },
                                                                        subtotal,
                                                                        total
                                                                    }, currentEntity.id || '');

                                                                    // Update quote with PDF URL
                                                                    await supabase
                                                                        .from('quotes')
                                                                        .update({ pdf_url: pdfUrl })
                                                                        .eq('id', quote.id);

                                                                    console.log('✅ PDF generated and saved:', pdfUrl);

                                                                    // Trigger webhook with complete data
                                                                    await webhookService.triggerWebhooks({
                                                                        eventType: 'QUOTE_SENT',
                                                                        payload: {
                                                                            quote: {
                                                                                id: fullQuote.id,
                                                                                quote_number: fullQuote.quote_number,
                                                                                status: fullQuote.status,
                                                                                total,
                                                                                subtotal,
                                                                                discount: fullQuote.discount || 0,
                                                                                discount_type: fullQuote.discount_type || 'amount',
                                                                                valid_until: fullQuote.valid_until,
                                                                                notes: fullQuote.notes,
                                                                                created_at: fullQuote.created_at,
                                                                                pdf_url: pdfUrl
                                                                            },
                                                                            customer: {
                                                                                id: fullQuote.contact?.id,
                                                                                name: fullQuote.contact?.name,
                                                                                email: fullQuote.contact?.email,
                                                                                phone: fullQuote.contact?.phone,
                                                                                address: fullQuote.contact?.address
                                                                            },
                                                                            items: fullQuote.items || [],
                                                                            company: {
                                                                                name: companyData?.name,
                                                                                email: companyData?.email,
                                                                                phone: companyData?.phone,
                                                                                address: companyData?.address
                                                                            }
                                                                        },
                                                                        companyId: currentEntity.type === 'company' ? currentEntity.id : undefined,
                                                                        userId: user!.id
                                                                    });

                                                                    console.log('✅ Proposta enviada com sucesso!');
                                                                    alert('✅ Proposta enviada com sucesso!');
                                                                } catch (error) {
                                                                    console.error('❌ Error:', error);
                                                                    alert('❌ Erro ao enviar proposta. Verifique o console.');
                                                                } finally {
                                                                    setSendingProposal(null);
                                                                }
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            disabled={sendingProposal === quote.id}
                                                        >
                                                            {sendingProposal === quote.id ? (
                                                                <Loader2 size={16} className="animate-spin" />
                                                            ) : (
                                                                <Send size={16} />
                                                            )}
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {/* Fiscal Button */}
                                                {quote.status === 'approved' && currentCompany?.fiscal_module_enabled && (
                                                    <Tooltip content={quote.nfe_id ? "Ver Nota Fiscal" : "Emitir NF-e"}>
                                                        <button
                                                            onClick={() => quote.nfe_id ? alert('Status da nota: ' + quote.nfe_status) : handleEmitFiscal(quote)}
                                                            className={`p-1 rounded transition-colors ${quote.nfe_id
                                                                ? 'text-emerald-600 hover:bg-emerald-50'
                                                                : 'text-orange-600 hover:bg-orange-50'
                                                                }`}
                                                            disabled={isEmittingFiscal === quote.id}
                                                        >
                                                            {isEmittingFiscal === quote.id ? (
                                                                <Loader2 size={16} className="animate-spin" />
                                                            ) : (
                                                                <FileText size={16} />
                                                            )}
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {/* Payment Action Button */}
                                                {quote.status === 'approved' && quote.payment_status !== 'paid' && (
                                                    <Tooltip content="Gerar Link de Pagamento">
                                                        <button
                                                            onClick={async () => {
                                                                if (!validatePaymentRequirements(quote)) return;

                                                                const activeGateway = gateways.find(g => g.is_active);
                                                                if (!activeGateway) {
                                                                    notify('warning', 'Gateway não configurado', 'Ative um gateway de pagamento nas configurações.');
                                                                    return;
                                                                }

                                                                // Check for existing pending charge
                                                                const existingCharge = charges.find(c => c.quote_id === quote.id && c.status === 'pending');
                                                                if (existingCharge) {
                                                                    const reuse = window.confirm('Já existe um link pendente para este orçamento. Deseja REUTILIZAR o link atual?\n\nPara gerar um NOVO link, você deve primeiro excluir a cobrança anterior na tela de Pagamentos.');
                                                                    if (reuse) {
                                                                        setPaymentResult({
                                                                            success: true,
                                                                            payment_link: existingCharge.payment_link,
                                                                            qr_code_base64: existingCharge.qr_code_base64,
                                                                            quote_id: quote.id
                                                                        });
                                                                        return;
                                                                    }
                                                                }

                                                                setIsGeneratingPayment(quote.id);
                                                                try {
                                                                    const res = await createCharge({
                                                                        provider: activeGateway.provider,
                                                                        config: activeGateway.config,
                                                                        is_sandbox: activeGateway.is_sandbox,
                                                                        customerId: quote.contact_id,
                                                                        quoteId: quote.id,
                                                                        payload: {
                                                                            amount: quote.total_amount,
                                                                            description: `Orçamento #${quote.quote_number || quote.id.slice(0, 8)}: ${quote.title}`,
                                                                            customer: {
                                                                                name: quote.contact?.name || 'Cliente',
                                                                                email: quote.contact?.email || 'financeiro@exemplo.com',
                                                                                tax_id: quote.contact?.tax_id
                                                                            }
                                                                        }
                                                                    });

                                                                    if (res.success) {
                                                                        setPaymentResult({ ...res, quote_id: quote.id });
                                                                        notify('success', 'Sucesso', 'Link de pagamento gerado!');
                                                                    } else {
                                                                        notify('error', 'Erro', res.error || 'Falha ao gerar link.');
                                                                    }
                                                                } catch (err) {
                                                                    notify('error', 'Erro', 'Erro de conexão.');
                                                                } finally {
                                                                    setIsGeneratingPayment(null);
                                                                }
                                                            }}
                                                            className="text-emerald-600 hover:text-emerald-800 p-1 rounded hover:bg-emerald-50"
                                                            disabled={isGeneratingPayment === quote.id}
                                                        >
                                                            {isGeneratingPayment === quote.id ? (
                                                                <Loader2 size={16} className="animate-spin" />
                                                            ) : (
                                                                <CreditCard size={16} />
                                                            )}
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {quote.status === 'sent' && (
                                                    <>
                                                        <Tooltip content="Aprovar">
                                                            <button
                                                                onClick={async () => handleApproveClick(quote)}
                                                                className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                        </Tooltip>
                                                        <Tooltip content="Rejeitar">
                                                            <button
                                                                onClick={() => updateQuoteStatus(quote.id, 'rejected')}
                                                                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </Tooltip>
                                                    </>
                                                )}

                                                {quote.status === 'rejected' && (
                                                    <>
                                                        <Tooltip content="Agendar Retorno">
                                                            <button
                                                                onClick={() => handleOpenRecovery(quote)}
                                                                className="text-orange-500 hover:text-orange-700 p-1 rounded hover:bg-orange-50"
                                                            >
                                                                <CalendarClock size={16} />
                                                            </button>
                                                        </Tooltip>
                                                        {quote.follow_up_date && (
                                                            <Tooltip content="Finalizar Recuperação">
                                                                <button
                                                                    onClick={() => handleFinalizeClick(quote)}
                                                                    className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 ml-1"
                                                                >
                                                                    <Check size={16} />
                                                                </button>
                                                            </Tooltip>
                                                        )}
                                                    </>
                                                )}

                                                <div className="h-4 w-px bg-gray-300 dark:bg-slate-600 mx-1"></div>

                                                <Tooltip content="Editar">
                                                    <button
                                                        onClick={() => navigate(`/quotes/${quote.id}`)}
                                                        className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Imprimir">
                                                    <button
                                                        onClick={() => navigate(`/quotes/${quote.id}/print`)}
                                                        className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                </Tooltip>
                                                {canDelete && (
                                                    <Tooltip content={
                                                        user?.email !== 'carloscleton.nat@gmail.com' && quote.status === 'approved' && (quote.payment_status === 'pending' || quote.payment_status === 'paid')
                                                            ? "🔒 Orçamento aprovado com pagamento não pode ser excluído"
                                                            : "Excluir"
                                                    }>
                                                        <button
                                                            onClick={() => handleDelete(quote)}
                                                            className={`p-1 rounded ${user?.email !== 'carloscleton.nat@gmail.com' && quote.status === 'approved' && (quote.payment_status === 'pending' || quote.payment_status === 'paid')
                                                                ? 'text-gray-300 cursor-not-allowed'
                                                                : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                                                                }`}
                                                            disabled={user?.email !== 'carloscleton.nat@gmail.com' && quote.status === 'approved' && (quote.payment_status === 'pending' || quote.payment_status === 'paid')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
            }

            {/* Approval Options Modal */}
            {
                showApprovalOptions && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Aprovar Orçamento</h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                O orçamento será marcado como <span className="font-bold text-green-600">Aprovado</span>. O que você deseja fazer em seguida?
                            </p>

                            <div className="flex flex-col gap-3">
                                <Button variant="primary" onClick={handleApproveReceive}>
                                    <Check className="mr-2" size={18} />
                                    Baixar / Receber Agora
                                    <span className="text-xs font-normal opacity-80 block text-left">Gera lançamento (Recebido) no Financeiro</span>
                                </Button>

                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={async () => {
                                        if (!quoteToApprove) return;

                                        if (!validatePaymentRequirements(quoteToApprove)) return;

                                        const activeGateway = gateways.find(g => g.is_active);
                                        if (!activeGateway) {
                                            notify('warning', 'Gateway não configurado', 'Ative um gateway de pagamento nas configurações.');
                                            return;
                                        }

                                        // Check for existing pending charge
                                        const existingCharge = charges.find(c => c.quote_id === quoteToApprove.id && c.status === 'pending');
                                        if (existingCharge) {
                                            const reuse = window.confirm('Já existe um link pendente para este orçamento. Deseja REUTILIZAR o link atual?\n\nPara gerar um NOVO link, você deve primeiro excluir a cobrança anterior na aba Pagamentos.');
                                            if (reuse) {
                                                // 1. Just approve without generating new transaction/charge
                                                await approveQuote(quoteToApprove.id, {
                                                    generateTransaction: false
                                                });

                                                setPaymentResult({
                                                    success: true,
                                                    payment_link: existingCharge.payment_link,
                                                    qr_code_base64: existingCharge.qr_code_base64,
                                                    quote_id: quoteToApprove.id
                                                });
                                                closeModals();
                                                return;
                                            }
                                        }

                                        // 1. Approve (generate pending transaction)
                                        await approveQuote(quoteToApprove.id, {
                                            generateTransaction: true,
                                            transactionStatus: 'pending'
                                        });

                                        // 2. Generate Charge
                                        setIsGeneratingPayment(quoteToApprove.id);
                                        try {
                                            const res = await createCharge({
                                                provider: activeGateway.provider,
                                                config: activeGateway.config,
                                                is_sandbox: activeGateway.is_sandbox,
                                                customerId: quoteToApprove.contact_id,
                                                quoteId: quoteToApprove.id,
                                                payload: {
                                                    amount: quoteToApprove.total_amount,
                                                    description: `Orçamento #${quoteToApprove.id.slice(0, 8)}: ${quoteToApprove.title}`,
                                                    customer: {
                                                        name: quoteToApprove.contact?.name || 'Cliente',
                                                        email: quoteToApprove.contact?.email || 'financeiro@exemplo.com',
                                                        tax_id: quoteToApprove.contact?.tax_id
                                                    }
                                                }
                                            });

                                            if (res.success) {
                                                setPaymentResult({ ...res, quote_id: quoteToApprove.id });
                                                notify('success', 'Sucesso', 'Link de pagamento gerado!');
                                            } else {
                                                notify('error', 'Erro', res.error || 'Falha ao gerar link.');
                                            }
                                        } catch (err) {
                                            notify('error', 'Erro', 'Erro de conexão.');
                                        } finally {
                                            setIsGeneratingPayment(null);
                                            closeModals();
                                        }
                                    }}
                                >
                                    <Rocket className="mr-2" size={18} />
                                    Aprovar e Gerar Link de Pagamento
                                    <span className="text-xs font-normal opacity-80 block text-left">Gera link Pix/Cartão e transação pendente</span>
                                </Button>

                                <Button variant="outline" onClick={handleApprovePending}>
                                    <FileText className="mr-2" size={18} />
                                    Gerar Contas a Receber (Pendente)
                                    <span className="text-xs font-normal opacity-80 block text-left">Gera lançamento pendente para futura baixa manual</span>
                                </Button>

                                <Button variant="ghost" onClick={handleJustApprove}>
                                    Apenas Aprovar (Sem Financeiro)
                                </Button>

                                <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={closeModals}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Fixed Summary Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 shadow-lg z-10 md:pl-64">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Exibindo {filteredQuotes.length} orçamentos
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Total de Descontos</span>
                            <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                                {formatCurrency(totalDiscount)}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>
                        <div className="text-right">
                            <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Valor Total</span>
                            <span className="text-xl font-bold text-gray-900 dark:text-white">
                                {formatCurrency(totalValue)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Padding */}
            <div className="h-24"></div>

            {/* Fiscal Modal */}
            {showFiscalModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg border border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${fiscalStatus.status === 'error' ? 'bg-red-100 text-red-600' :
                                fiscalStatus.status === 'success' ? 'bg-green-100 text-green-600' :
                                    'bg-blue-100 text-blue-600'
                                }`}>
                                <FileText size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Emissão de Nota Fiscal</h3>
                                <p className="text-sm text-gray-500">TecnoSpeed PlugNotas v2</p>
                            </div>
                        </div>

                        <div className="space-y-4 py-4">
                            {fiscalStatus.status === 'loading' && (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <Loader2 size={48} className="animate-spin text-blue-500 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-300 font-medium">{fiscalStatus.message}</p>
                                </div>
                            )}

                            {fiscalStatus.status === 'success' && (
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                                    <div className="flex gap-3">
                                        <Check className="text-green-600 shrink-0" size={20} />
                                        <p className="text-sm text-green-800 dark:text-green-300">{fiscalStatus.message}</p>
                                    </div>
                                </div>
                            )}

                            {fiscalStatus.status === 'error' && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                                    <div className="flex gap-3">
                                        <X className="text-red-600 shrink-0" size={20} />
                                        <div>
                                            <p className="text-sm font-bold text-red-800 dark:text-red-300">Erro na Emissão</p>
                                            <p className="text-xs text-red-700 dark:text-red-400 mt-1">{fiscalStatus.message}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button variant="outline" onClick={() => setShowFiscalModal(false)}>
                                Fechar
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settle Modal for Receiving */}
            {
                quoteToApprove && (
                    <SettleModal
                        isOpen={showSettleModal}
                        onClose={closeModals}
                        onConfirm={handleSettleConfirm}
                        transactionType="income"
                        transactionAmount={quoteToApprove.total_amount}
                        transactionDescription={`Ref. Orçamento: ${quoteToApprove.title}`}
                        transactionDueDate={quoteToApprove.valid_until ? new Date(quoteToApprove.valid_until).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                    />
                )
            }

            {/* Recovery Modal */}
            {showRecoveryModal && recoveryQuote && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <CalendarClock size={20} className="text-orange-500" />
                                Agendar Retorno
                            </h3>
                            <button onClick={() => setShowRecoveryModal(false)} className="text-gray-400 hover:text-gray-500">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Defina uma data para tentar recuperar o orçamento <strong>#{recoveryQuote.id.slice(0, 8)}...</strong>
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Data de Retorno
                                </label>
                                <input
                                    type="date"
                                    value={recoveryDate}
                                    onChange={(e) => setRecoveryDate(e.target.value)}
                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Notas de Negociação
                                </label>
                                <textarea
                                    value={recoveryNotes}
                                    onChange={(e) => setRecoveryNotes(e.target.value)}
                                    placeholder="Ex: Oferecer desconto, ligar novamente..."
                                    rows={3}
                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600"
                                />
                            </div>

                            <div className="flex justify-end pt-2 gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowRecoveryModal(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleScheduleFollowUp}
                                    className="bg-orange-500 hover:bg-orange-600 text-white"
                                >
                                    Agendar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Finalize Recovery Modal */}
            {showFinalizeModal && finalizeQuote && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-slate-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Finalizar Recuperação</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            Qual foi o resultado do contato com o cliente <strong>{finalizeQuote.contact?.name}</strong>?
                        </p>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={handleRecoverySuccess}
                                className="bg-green-600 hover:bg-green-700 text-white w-full justify-center"
                            >
                                <Check size={18} className="mr-2" />
                                Recuperada com Sucesso
                                <span className="block text-xs opacity-80 font-normal ml-2">(Aprovar Orçamento)</span>
                            </Button>

                            <Button
                                onClick={handleRecoveryFailure}
                                className="bg-red-600 hover:bg-red-700 text-white w-full justify-center"
                            >
                                <X size={18} className="mr-2" />
                                Não Recuperada
                                <span className="block text-xs opacity-80 font-normal ml-2">(Manter Rejeitado)</span>
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => setShowFinalizeModal(false)}
                                className="w-full justify-center mt-2"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {/* Payment Link Modal */}
            <Modal
                isOpen={!!paymentResult}
                onClose={() => setPaymentResult(null)}
                title="Pagamento Gerado"
                icon={Rocket}
                maxWidth="max-w-md"
            >
                <div className="py-6 text-center space-y-6">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                        <Check size={48} />
                    </div>
                    <div>
                        <h4 className="text-xl font-bold dark:text-white">Link Pronto!</h4>
                        <p className="text-sm text-gray-500">O pagamento foi gerado e vinculado a este orçamento.</p>
                    </div>

                    {paymentResult?.qr_code_base64 && (
                        <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-gray-100 inline-block">
                            <img
                                src={`data:image/png;base64,${paymentResult.qr_code_base64}`}
                                className="w-48 h-48 mx-auto"
                                alt="PIX QR Code"
                            />
                        </div>
                    )}

                    <div className="space-y-3 max-w-sm mx-auto">
                        <Button
                            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => {
                                const quote = quotes.find(q => q.id === paymentResult.quote_id);
                                if (quote) handleSendWhatsApp(quote, paymentResult);
                            }}
                            disabled={isSendingWhatsApp}
                        >
                            {isSendingWhatsApp ? (
                                <Loader2 size={18} className="mr-2 animate-spin" />
                            ) : (
                                <Send size={18} className="mr-2" />
                            )}
                            Enviar via WhatsApp
                        </Button>
                        <Button
                            className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            onClick={() => {
                                navigator.clipboard.writeText(paymentResult.payment_link);
                                notify('success', 'Copiado', 'Link copiado com sucesso!');
                            }}
                        >
                            <Copy size={18} className="mr-2" />
                            Copiar Link
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => setPaymentResult(null)}>
                            Fechar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
