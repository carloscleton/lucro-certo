import { useState, useMemo, useEffect } from 'react';
import { Plus, FileText, Check, X, Printer, Trash2, Edit, Calendar, AlertTriangle, Send, Loader2, CalendarClock, CreditCard, Copy, Rocket, Search, DollarSign, ShieldCheck, Globe, Mail, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useQuotes, type Quote } from '../hooks/useQuotes';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Tooltip } from '../components/ui/Tooltip';

import { SettleModal } from '../components/transactions/SettleModal';
import { Modal } from '../components/ui/Modal';
import { useTransactions } from '../hooks/useTransactions';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { useTeam } from '../hooks/useTeam';
import { useCharges } from '../hooks/useCharges';
import { usePaymentGateways } from '../hooks/usePaymentGateways';
import { useNotification } from '../context/NotificationContext';
import { webhookService } from '../services/webhookService';
import { fiscalService } from '../services/fiscalService';
import { whatsappService } from '../services/whatsappService';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/constants';
import { PDFService } from '../services/pdfService';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { ResultModal } from '../components/ui/ResultModal';

export function Quotes() {
    const navigate = useNavigate();
    const location = useLocation();
    const { quotes, isRefreshing, deleteQuote, updateQuoteStatus, approveQuote, resetQuotePayment, scheduleFollowUp, refresh: refreshQuotes } = useQuotes();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');

    const { createCharge, charges } = useCharges();
    const { gateways } = usePaymentGateways();
    const { notify } = useNotification();
    const [paymentResult, setPaymentResult] = useState<any>(null);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [waInstances, setWaInstances] = useState<any[]>([]);
    const [isSettlingExisting, setIsSettlingExisting] = useState(false);

    // Modal States
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [quoteToReset, setQuoteToReset] = useState<Quote | null>(null);
    const [reuseConfirmOpen, setReuseConfirmOpen] = useState(false);
    const [chargeToReuse, setChargeToReuse] = useState<any>(null);
    const [resultModal, setResultModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error'}>({
        isOpen: false, title: '', message: '', type: 'success'
    });

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

    const { fetchTransactionsByQuoteIds } = useTransactions('expense');


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

            const response = await fetch(`${API_BASE_URL}/whatsapp/send`, {
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
            setResultModal({
                isOpen: true,
                title: 'Sucesso',
                message: 'Retorno agendado com sucesso!',
                type: 'success'
            });
        } catch (error) {
            console.error('Error scheduling follow-up:', error);
            setResultModal({
                isOpen: true,
                title: 'Erro',
                message: 'Erro ao agendar retorno.',
                type: 'error'
            });
        }
    };

    const handleSaveWhatsApp = async () => {
        if (!waTargetQuote || !waNumber) return;
        
        setIsSavingWA(true);
        try {
            // Update contact in database
            const { error } = await supabase
                .from('contacts')
                .update({ phone: waNumber })
                .eq('id', waTargetQuote.contact_id);

            if (error) throw error;

            // Update local quote object with proper type casting to satisfy Quote interface
            const updatedQuote = { 
                ...waTargetQuote, 
                contact: { 
                    ...waTargetQuote.contact, 
                    name: waTargetQuote.contact?.name || 'Cliente',
                    phone: waNumber 
                } 
            } as Quote;
            
            notify('success', 'Sucesso', 'Telefone atualizado!');
            setShowWAModal(false);

            // Execute the original action
            if (waAction === 'proposal') {
                processSendProposal(updatedQuote);
            } else {
                handleSendWhatsApp(updatedQuote, paymentResult);
            }
        } catch (err) {
            console.error('Error saving phone:', err);
            notify('error', 'Erro', 'Falha ao salvar telefone.');
        } finally {
            setIsSavingWA(false);
        }
    };

    const processSendProposal = async (quote: Quote) => {
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
                    legal_name: companyData?.legal_name,
                    cnpj: companyData?.cnpj,
                    cpf: companyData?.cpf,
                    entity_type: companyData?.entity_type || 'PJ',
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

            // 📱 Native WhatsApp Send (Priority: Direct send if instance connected)
            const instance = waInstances[0];
            const phone = fullQuote.contact?.phone?.replace(/\D/g, '');

            if (instance && phone) {
                console.log('📱 Sending native WhatsApp message...');
                const message = `Olá, ${fullQuote.contact?.name || 'cliente'}! Segue o link para visualizar sua proposta:\n\n🔗 ${window.location.origin}/p/${fullQuote.id}\n\nObrigado pela confiança!`;
                
                try {
                    await whatsappService.sendMessage({
                        instanceName: instance.instance_name,
                        number: phone,
                        text: message
                    });
                    console.log('✅ Native WhatsApp message sent!');
                } catch (waError) {
                    console.error('❌ Failed to send native WA message:', waError);
                    // Don't throw, we'll still notify that PDF was generated
                }
            }

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
                companyId: fullQuote.company_id || undefined, // Use quote's own company_id
                userId: user!.id
            });

            console.log('✅ Proposta enviada com sucesso!');
            notify('success', 'Sucesso', 'Proposta enviada!');
            refreshQuotes();
        } catch (error) {
            console.error('❌ Error:', error);
            notify('error', 'Erro', 'Erro ao enviar proposta.');
        } finally {
            setSendingProposal(null);
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
    const [showWAModal, setShowWAModal] = useState(false);
    const [waNumber, setWaNumber] = useState('');
    const [waTargetQuote, setWaTargetQuote] = useState<Quote | null>(null);
    const [waAction, setWaAction] = useState<'proposal' | 'payment'>('proposal');
    const [isSavingWA, setIsSavingWA] = useState(false);

    // Helper to get local date ISO string YYYY-MM-DD
    const getLocalDateISO = (date: Date = new Date()) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    // Default to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const initialStartDate = searchParams.get('start') || getLocalDateISO(firstDay);
    const initialEndDate = searchParams.get('end') || getLocalDateISO(lastDay);
    // Default 'all' to true if not present, otherwise use the value from URL
    const initialShowAll = searchParams.get('all') !== null 
        ? searchParams.get('all') === 'true' 
        : (sessionStorage.getItem('quotes_show_all') !== null 
            ? sessionStorage.getItem('quotes_show_all') === 'true' 
            : true);

    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [showAll, setShowAll] = useState(initialShowAll);

    const updateFilters = (newFilters: any) => {
        const params = new URLSearchParams(searchParams);
        Object.entries(newFilters).forEach(([key, val]) => {
            if (val !== null && val !== undefined) params.set(key, val.toString());
            else params.delete(key);
        });
        setSearchParams(params);
    };

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

    // Automation states
    const [sendEmail, setSendEmail] = useState(false);
    const [sendWhatsApp, setSendWhatsApp] = useState(false);
    const [fiscalQuote, setFiscalQuote] = useState<Quote | null>(null);
    const [fullFiscalQuote, setFullFiscalQuote] = useState<any | null>(null);
    const [loadingQuoteDetails, setLoadingQuoteDetails] = useState(false);
    const [emissionStrategy, setEmissionStrategy] = useState<'group' | 'split'>('group');

    // Expense Data
    const [quoteExpenses, setQuoteExpenses] = useState<Record<string, number>>({});

    const statusLabels = {
        draft: 'Rascunho',
        sent: 'Enviado',
        approved: 'Aprovado',
        rejected: 'Rejeitado',
        cancelled: 'Perdido',
    };

    const handleDelete = async (quote: Quote) => {
        if (!canDelete) {
            setResultModal({
                isOpen: true,
                title: 'Acesso Negado',
                message: 'Você não tem permissão para excluir orçamentos.',
                type: 'error'
            });
            return;
        }

        // 🔓 SUPER ADMIN: Bypass all protections
        const isSuperAdmin = user?.email === 'carloscleton.nat@gmail.com';

        if (!isSuperAdmin) {
            // 🔒 Check if quote is protected (only for non-super-admins)
            if (quote.status === 'approved' && (quote.payment_status === 'pending' || quote.payment_status === 'paid')) {
                setResultModal({
                    isOpen: true,
                    title: 'Ação Bloqueada',
                    message: 'Não é possível excluir orçamentos aprovados com pagamento associado.',
                    type: 'error'
                });
                return;
            }
        }

        setQuoteToDelete(quote);
        setDeleteConfirmOpen(true);
    };

    const executeDelete = async () => {
        if (!quoteToDelete) return;
        try {
            await deleteQuote(quoteToDelete.id);
            setDeleteConfirmOpen(false);
            setResultModal({
                isOpen: true,
                title: 'Sucesso',
                message: 'Orçamento removido com sucesso.',
                type: 'success'
            });
        } catch (error: any) {
            setDeleteConfirmOpen(false);
            setResultModal({
                isOpen: true,
                title: 'Erro ao Excluir',
                message: error.message || 'Erro ao processar exclusão.',
                type: 'error'
            });
        } finally {
            setQuoteToDelete(null);
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
        // If quote already has a pending transaction, settle it directly instead of creating new
        if (quoteToApprove?.payment_status === 'pending') {
            setIsSettlingExisting(true);
        }
        setShowSettleModal(true);
    };

    const handleSettleConfirm = async (date: string, paymentMethod: string, interest: number, penalty: number, totalAmount: number, notes: string) => {
        if (!quoteToApprove) return;

        if (isSettlingExisting) {
            // Find and update the existing pending transaction
            try {
                const { data: existingTx, error: findError } = await supabase
                    .from('transactions')
                    .select('id')
                    .eq('quote_id', quoteToApprove.id)
                    .eq('type', 'income')
                    .maybeSingle();

                if (findError || !existingTx) {
                    // No existing tx found, fall back to creating via approveQuote
                    await approveQuote(quoteToApprove.id, {
                        generateTransaction: true,
                        transactionStatus: 'received',
                        paymentDetails: { date, method: paymentMethod, interest, penalty, amount: totalAmount, notes }
                    });
                } else {
                    // Update existing transaction to received
                    const { error: updateError } = await supabase
                        .from('transactions')
                        .update({
                            status: 'received',
                            payment_date: date,
                            payment_method: paymentMethod,
                            interest: interest || null,
                            penalty: penalty || null,
                            paid_amount: totalAmount,
                            notes: notes || undefined
                        })
                        .eq('id', existingTx.id);

                    if (updateError) throw updateError;

                    // Update quote payment_status to paid
                    await supabase
                        .from('quotes')
                        .update({ payment_status: 'paid' })
                        .eq('id', quoteToApprove.id);

                    // CLUBE VIP RECOVERY Logic
                    if (currentCompany?.loyalty_module_enabled) {
                        const { data: quoteItems } = await supabase.from('quote_items').select('description').eq('quote_id', quoteToApprove.id);
                        if (quoteItems?.some(i => i.description.includes('[Clube VIP] Regularização'))) {
                            await supabase
                                .from('loyalty_subscriptions')
                                .update({ status: 'active', canceled_at: null })
                                .eq('contact_id', quoteToApprove.contact_id);
                            notify('success', 'Clube VIP Reativado', 'A assinatura foi reativada automaticamente.');
                        }
                    }

                    await refreshQuotes();
                    notify('success', 'Pagamento Registrado', 'Baixa realizada com sucesso!');
                }
            } catch (err: any) {
                console.error('Erro ao dar baixa:', err);
                notify('error', 'Erro', err.message || 'Falha ao registrar pagamento.');
            }
        } else {
            await approveQuote(quoteToApprove.id, {
                generateTransaction: true,
                transactionStatus: 'received',
                paymentDetails: { date, method: paymentMethod, interest, penalty, amount: totalAmount, notes }
            });
        }

        setIsSettlingExisting(false);
        closeModals();
    };

    const handleResetPayment = async (quote: Quote) => {
        setQuoteToReset(quote);
        setResetConfirmOpen(true);
    };

    const executeResetPayment = async () => {
        if (!quoteToReset) return;
        try {
            const { error } = await resetQuotePayment(quoteToReset.id);
            setResetConfirmOpen(false);
            if (error) throw error;
            
            setResultModal({
                isOpen: true,
                title: 'Sucesso',
                message: 'Status resetado com sucesso! O orçamento voltou para "Aguardando Pagamento".',
                type: 'success'
            });
        } catch (error: any) {
            setResetConfirmOpen(false);
            setResultModal({
                isOpen: true,
                title: 'Erro ao Resetar',
                message: error.message || 'Erro ao processar solicitação.',
                type: 'error'
            });
        } finally {
            setQuoteToReset(null);
        }
    };

    const closeModals = () => {
        setQuoteToApprove(null);
        setShowApprovalOptions(false);
        setShowSettleModal(false);
        setShowFinalizeModal(false);
        setFinalizeQuote(null);
        setIsSettlingExisting(false);
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
            setResultModal({
                isOpen: true,
                title: 'Recuperação Concluída',
                message: 'Recuperação realizada com sucesso! Gerado contas a receber (Pendente).',
                type: 'success'
            });
        } catch (err) {
            console.error(err);
            setResultModal({
                isOpen: true,
                title: 'Erro',
                message: 'Erro ao finalizar recuperação.',
                type: 'error'
            });
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
            setResultModal({
                isOpen: true,
                title: 'Recuperação Finalizada',
                message: 'Orçamento marcado como Perdido.',
                type: 'success'
            });
        } catch (err) {
            console.error(err);
            setResultModal({
                isOpen: true,
                title: 'Erro',
                message: 'Erro ao finalizar.',
                type: 'error'
            });
        }
    };

    const handleEmitFiscal = async (quote: Quote) => {
        if (!currentEntity.id) return;

        // Initialize automation states from company config
        const config = currentCompany?.tecnospeed_config as any;
        setSendEmail(config?.send_email_automatically || false);
        setSendWhatsApp(config?.send_whatsapp_automatically || false);
        setFiscalQuote(quote);
        setFullFiscalQuote(null);
        setEmissionStrategy('group');
        setLoadingQuoteDetails(true);

        setIsEmittingFiscal(quote.id);
        setFiscalStatus({ status: 'idle' });
        setShowFiscalModal(true);

        try {
            const { data: fullQuote, error: quoteError } = await supabase
                .from('quotes')
                .select('*, items:quote_items(*), contact:contact_id(*)')
                .eq('id', quote.id)
                .single();

            if (!quoteError && fullQuote) {
                setFullFiscalQuote(fullQuote);
            }
        } catch (err) {
            console.error('Erro ao buscar detalhes do orçamento:', err);
        } finally {
            setLoadingQuoteDetails(false);
        }
    };

    const executeEmitFiscal = async (quote: Quote) => {
        if (!currentEntity.id) return;

        setIsEmittingFiscal(quote.id);
        setFiscalStatus({ status: 'loading' });

        try {
            if (!currentCompany || !currentCompany.tecnospeed_config) {
                throw new Error('Configurações fiscais da empresa não encontradas.');
            }

            // Fetch full quote details
            const { data: fullQuote, error: quoteError } = await supabase
                .from('quotes')
                .select('*, items:quote_items(*, service:service_id(codigo_tributacao_nacional)), contact:contact_id(*)')
                .eq('id', quote.id)
                .single();

            if (quoteError || !fullQuote) throw new Error('Erro ao buscar itens do orçamento.');

            // Check if customer has tax_id
            if (!fullQuote.contact?.tax_id) {
                throw new Error('O cliente do orçamento não possui CPF/CNPJ cadastrado.');
            }

            // 1. Detect if it is Service or Product
            const isServiceOnly = fullQuote.items.every((item: any) => item.service_id);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada. Faça login novamente.');

            const isNacional = (currentCompany.tecnospeed_config as any)?.nfse_nacional || false;

            let result;

            if (isServiceOnly) {
                // Validate if any service is missing the municipal code
                const missingServiceCode = fullQuote.items.find((item: any) => !item.codigo_servico_municipal);
                if (missingServiceCode) {
                    throw new Error(`O serviço "${missingServiceCode.description}" não possui o Código de Serviço Municipal preenchido. Acesse Serviços > Editar e preencha este dado obrigatório para a emissão da NFS-e.`);
                }
                
                if (isNacional) {
                    const invalidItem = fullQuote.items.find((item: any) => {
                        const code = item.codigo_tributacao_nacional || item.codigo_tributacao || item.service?.codigo_tributacao_nacional || (currentCompany.tecnospeed_config as any)?.default_taxation_code;
                        return !code || code.replace(/\D/g, '').length !== 9;
                    });
                    if (invalidItem) {
                        throw new Error(`O serviço "${invalidItem.description}" não possui um Código de Tributação Nacional válido (9 dígitos). Verifique o cadastro do serviço ou o padrão nas Configurações Fiscais.`);
                    }
                }

                const isHomolog = (currentCompany.tecnospeed_config as any)?.ambiente === 'homologacao' || (currentCompany.tecnospeed_config as any)?.use_test_data;
                const defaultCityCode = isHomolog ? '4115200' : ((currentCompany.tecnospeed_config as any)?.endereco?.codigoCidade || '3106200');
                const companyCityCode = (currentCompany.tecnospeed_config as any)?.endereco?.codigoCidade || (currentCompany.tecnospeed_config as any)?.codigo_municipio || '3106200';

                // 1. Resolução dinâmica do código IBGE do Tomador (Cliente)
                let tomadorCityCode = defaultCityCode;
                const contactCep = fullQuote.contact?.zip_code?.replace(/\D/g, '');
                const contactCity = fullQuote.contact?.city;
                const contactState = fullQuote.contact?.state;

                if (contactCep && contactCep.length === 8) {
                    try {
                        const cepRes = await fetch(`https://viacep.com.br/ws/${contactCep}/json/`);
                        const cepData = await cepRes.json();
                        if (!cepData.erro && cepData.ibge) {
                            tomadorCityCode = cepData.ibge;
                        }
                    } catch (err) {
                        console.warn('Erro ao obter IBGE via CEP:', err);
                    }
                }

                if (tomadorCityCode === defaultCityCode && contactCity && contactState) {
                    try {
                        const stateCode = contactState.trim().toUpperCase();
                        const cityRes = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios`);
                        const cities = await cityRes.json();
                        if (Array.isArray(cities)) {
                            const cleanString = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                            const target = cleanString(contactCity);
                            const match = cities.find((c: any) => cleanString(c.nome) === target);
                            if (match) {
                                tomadorCityCode = String(match.id);
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao obter IBGE via Cidade/UF:', err);
                    }
                }

                if (isNacional && fullQuote.items.length > 1 && emissionStrategy === 'group') {
                    // GROUP/CONSOLIDATE STRATEGY
                    const totalVal = fullQuote.items.reduce((acc: number, item: any) => acc + (Number(item.unit_price) * Number(item.quantity)), 0);
                    const combinedDesc = fullQuote.items.map((item: any) => `${item.description} (x${item.quantity})`).join(' + ');
                    
                    const firstItem = fullQuote.items[0];
                    const rawTaxCode = firstItem.codigo_tributacao_nacional || firstItem.codigo_tributacao || firstItem.service?.codigo_tributacao_nacional || (currentCompany.tecnospeed_config as any)?.default_taxation_code || '010101001';
                    const finalNatCode = rawTaxCode.replace(/\D/g, '').substring(0, 9).padEnd(9, '0');

                    const payload: any = {
                        idIntegracao: fullQuote.id,
                        codigoIbge: companyCityCode,
                        prestador: {
                            cpfCnpj: currentCompany.cnpj?.replace(/\D/g, '') || (currentCompany.tecnospeed_config as any)?.cnpj?.replace(/\D/g, ''),
                            inscricaoMunicipal: (currentCompany.tecnospeed_config as any)?.inscricao_municipal || (currentCompany.tecnospeed_config as any)?.prestador?.inscricaoMunicipal || (currentCompany as any).inscricao_municipal || ''
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
                                codigoCidade: tomadorCityCode,
                                uf: fullQuote.contact?.state || ''
                            }
                        },
                        servico: [{
                            codigo: (firstItem.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 6).padEnd(6, '0'),
                            codigoIbge: companyCityCode,
                            descricao: combinedDesc.substring(0, 2000),
                            discriminacao: combinedDesc.substring(0, 2000),
                            valor: {
                                servico: totalVal
                            },
                            quantidade: 1,
                            itemListaServico: (firstItem.item_lista_servico || '01.01').replace(/[^\d.]/g, ''),
                            codigoTributacao: (firstItem.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 3).padEnd(3, '0'),
                            codigoTributacaoNacional: finalNatCode,
                            codigotributacao: (firstItem.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 3).padEnd(3, '0'),
                            naturezaOperacao: 1
                        }]
                    };

                    if (sendEmail && fullQuote.contact?.email) {
                        payload.configuracao = {
                            email: {
                                envio: true,
                                destinatarios: [fullQuote.contact.email]
                            }
                        };
                    }

                    setFiscalStatus({ status: 'loading', message: 'Enviando NFS-e Consolidada...' });
                    result = await fiscalService.emitirNFSe(currentEntity.id, payload, token, quote.id);

                } else if (isNacional && fullQuote.items.length > 1 && emissionStrategy === 'split') {
                    // SPLIT STRATEGY
                    const createdIds: string[] = [];
                    
                    for (let i = 0; i < fullQuote.items.length; i++) {
                        const item = fullQuote.items[i];
                        const displayIndex = i + 1;
                        
                        setFiscalStatus({ 
                            status: 'loading', 
                            message: `Enviando Nota ${displayIndex} de ${fullQuote.items.length} ("${item.description}")...` 
                        });

                        const rawTaxCode = item.codigo_tributacao_nacional || item.codigo_tributacao || item.service?.codigo_tributacao_nacional || (currentCompany.tecnospeed_config as any)?.default_taxation_code || '010101001';
                        const finalNatCode = rawTaxCode.replace(/\D/g, '').substring(0, 9).padEnd(9, '0');

                        // Unique id for this sub-emission
                        const uniqueId = `${fullQuote.id}_${displayIndex}_${Date.now()}`;

                        const payload: any = {
                            idIntegracao: uniqueId,
                            codigoIbge: companyCityCode,
                            prestador: {
                                cpfCnpj: currentCompany.cnpj?.replace(/\D/g, '') || (currentCompany.tecnospeed_config as any)?.cnpj?.replace(/\D/g, ''),
                                inscricaoMunicipal: (currentCompany.tecnospeed_config as any)?.inscricao_municipal || (currentCompany.tecnospeed_config as any)?.prestador?.inscricaoMunicipal || (currentCompany as any).inscricao_municipal || ''
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
                                    codigoCidade: tomadorCityCode,
                                    uf: fullQuote.contact?.state || ''
                                }
                            },
                            servico: [{
                                  codigo: (item.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 6).padEnd(6, '0'),
                                  codigoIbge: companyCityCode,
                                  descricao: item.description,
                                  discriminacao: item.description,
                                  valor: {
                                      servico: item.unit_price
                                  },
                                  quantidade: item.quantity,
                                  itemListaServico: (item.item_lista_servico || '01.01').replace(/[^\d.]/g, ''),
                                  codigoTributacao: (item.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 3).padEnd(3, '0'),
                                  codigoTributacaoNacional: finalNatCode,
                                  codigotributacao: (item.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 3).padEnd(3, '0'),
                                  naturezaOperacao: 1
                            }]
                        };

                        if (sendEmail && fullQuote.contact?.email) {
                            payload.configuracao = {
                                email: {
                                    envio: true,
                                    destinatarios: [fullQuote.contact.email]
                                }
                            };
                        }

                        const res = await fiscalService.emitirNFSe(currentEntity.id, payload, token, quote.id);
                        const externalId = res.data?.id || res.id;
                        if (externalId) {
                            createdIds.push(externalId);
                        }
                    }

                    // Mock a merged response to feed the remainder of the flow
                    result = {
                        id: createdIds.join(','),
                        data: { id: createdIds.join(',') }
                    };

                } else {
                    // STANDARD / MUNICIPAL OR SINGLE ITEM NATIONAL STRATEGY
                    const payload: any = {
                        idIntegracao: fullQuote.id,
                        codigoIbge: companyCityCode,
                        prestador: {
                            cpfCnpj: currentCompany.cnpj?.replace(/\D/g, '') || (currentCompany.tecnospeed_config as any)?.cnpj?.replace(/\D/g, ''),
                            inscricaoMunicipal: (currentCompany.tecnospeed_config as any)?.inscricao_municipal || (currentCompany.tecnospeed_config as any)?.prestador?.inscricaoMunicipal || (currentCompany as any).inscricao_municipal || ''
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
                                codigoCidade: tomadorCityCode,
                                uf: fullQuote.contact?.state || ''
                            }
                        },
                        servico: fullQuote.items.map((item: any) => {
                            const payloadItem: any = {
                                codigo: (item.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 6).padEnd(6, '0'),
                                codigoIbge: companyCityCode,
                                descricao: item.description,
                                discriminacao: item.description,
                                valor: {
                                    servico: item.unit_price
                                },
                                quantidade: item.quantity,
                                itemListaServico: (item.item_lista_servico || '01.01').replace(/[^\d.]/g, '')
                            };

                            if (isNacional) {
                                const rawTaxCode = item.codigo_tributacao_nacional || item.codigo_tributacao || item.service?.codigo_tributacao_nacional || (currentCompany.tecnospeed_config as any)?.default_taxation_code || '010101001';
                                const finalNatCode = rawTaxCode.replace(/\D/g, '').substring(0, 9).padEnd(9, '0');
                                payloadItem.codigoTributacao = (item.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 3).padEnd(3, '0');
                                payloadItem.codigoTributacaoNacional = finalNatCode;
                                payloadItem.codigotributacao = (item.codigo_servico_municipal || '001').replace(/\D/g, '').substring(0, 3).padEnd(3, '0');
                                payloadItem.naturezaOperacao = 1;
                            }

                            return payloadItem;
                        })
                    };

                    if (sendEmail && fullQuote.contact?.email) {
                        payload.configuracao = {
                            email: {
                                envio: true,
                                destinatarios: [fullQuote.contact.email]
                            }
                        };
                    }

                    setFiscalStatus({ status: 'loading', message: 'Enviando NFS-e (Serviços)...' });
                    result = await fiscalService.emitirNFSe(currentEntity.id, payload, token, quote.id);
                }
            } else {
                // Validate if any product is missing the NCM
                const missingNcm = fullQuote.items.find((item: any) => !item.service_id && !item.ncm);
                if (missingNcm) {
                    throw new Error(`O produto "${missingNcm.description}" não possui o NCM preenchido. Acesse o cadastro do produto e preencha o NCM obrigatório para a emissão da NF-e.`);
                }

                // Map to PlugNotas format (NF-e - Products)
                const payload: any = {
                    idIntegracao: fullQuote.id,
                    presenca: 1,
                    natureza: 'Venda de Mercadoria',
                    isHomolog: (currentCompany.tecnospeed_config as any)?.ambiente === 'homologacao',
                    destinatario: {
                        cpfCnpj: fullQuote.contact?.tax_id?.replace(/\D/g, ''),
                        razaoSocial: fullQuote.contact?.name,
                        email: fullQuote.contact?.email,
                        endereco: {
                            logradouro: fullQuote.contact?.street || '',
                            numero: fullQuote.contact?.number || 'S/N',
                            bairro: fullQuote.contact?.neighborhood || '',
                            cep: fullQuote.contact?.zip_code?.replace(/\D/g, ''),
                            codigoCidade: (currentCompany.tecnospeed_config as any)?.ambiente === 'homologacao' || (currentCompany.tecnospeed_config as any)?.use_test_data ? '4115200' : ((currentCompany.tecnospeed_config as any)?.endereco?.codigoCidade || '3106200'),
                            uf: fullQuote.contact?.state || ''
                        }
                    },
                    itens: fullQuote.items.map((item: any) => ({
                        codigo: item.service_id || item.product_id || '001',
                        descricao: item.description,
                        ncm: item.ncm || '00000000',
                        cest: item.cest || '',
                        cfop: item.service_id ? '5933' : '5102', // 5933 para servico em NFe
                        valorUnitario: { comercial: item.unit_price },
                        total: {
                            vProd: item.total_price
                        },
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

                // Add email automation
                if (sendEmail && fullQuote.contact?.email) {
                    payload.configuracao = {
                        email: {
                            envio: true,
                            destinatarios: [fullQuote.contact.email]
                        }
                    };
                }

                setFiscalStatus({ status: 'loading', message: 'Enviando NF-e (Produtos)...' });
                result = await fiscalService.emitirNFe(currentEntity.id, payload, token, quote.id);
            }

            const externalId = result.data?.id || result.id;
            const isSplitEmission = isNacional && isServiceOnly && fullQuote.items.length > 1 && emissionStrategy === 'split';

            setFiscalStatus({
                status: 'success',
                message: isSplitEmission 
                    ? `${fullQuote.items.length} notas enviadas com sucesso! IDs: ${externalId}`
                    : `Nota enviada com sucesso! ID: ${externalId || 'Pendente'}`
            });

            // Update quote with NFe ID
            if (externalId) {
                await supabase.from('quotes').update({
                    nfe_id: externalId,
                    nfe_status: 'processando'
                }).eq('id', quote.id);

                // Automations
                if (sendWhatsApp && fullQuote.contact?.phone) {
                    try {
                        const waMsg = isSplitEmission
                            ? `Olá *${fullQuote.contact.name}*, as *${fullQuote.items.length}* notas fiscais referentes ao seu orçamento *${fullQuote.title}* foram emitidas e estão sendo processadas. Em breve você receberá os links para download.`
                            : `Olá *${fullQuote.contact.name}*, sua nota fiscal referente ao orçamento *${fullQuote.title}* foi emitida e está sendo processada. Em breve você receberá o link para download.`;
                        const instance = waInstances[0];
                        if (instance) {
                            await whatsappService.sendMessage({
                                instanceName: instance.instance_name,
                                number: fullQuote.contact.phone.replace(/\D/g, ''),
                                text: waMsg
                            });
                        }
                    } catch (waErr) {
                        console.error('Erro ao enviar WhatsApp:', waErr);
                    }
                }
            }

        } catch (error: any) {
            console.error('Erro fiscal:', error);
            
            let displayMessage = error.message || 'Erro desconhecido na emissão.';
            
            if (error.response?.data) {
                const data = error.response.data;
                if (data.detail) {
                    const detail = data.detail;
                    const innerMsg = detail.error?.message || detail.message || (typeof detail === 'string' ? detail : null);
                    const validationErrors = detail.error?.erros || detail.errors;
                    const validationFields = detail.error?.data?.fields;
                    
                    if (Array.isArray(validationErrors) && validationErrors.length > 0) {
                        const formattedErrors = validationErrors.map((err: any) => {
                            const field = err.campo || err.field || '';
                            const msg = err.mensagem || err.message || '';
                            return field ? `• ${field}: ${msg}` : `• ${msg}`;
                        }).join('\n');
                        displayMessage = `${innerMsg || 'Erro de validação na TecnoSpeed'}:\n${formattedErrors}`;
                    } else if (validationFields && typeof validationFields === 'object') {
                        const formattedErrors = Object.entries(validationFields).map(([field, msg]) => {
                            return `• ${field}: ${msg}`;
                        }).join('\n');
                        displayMessage = `${innerMsg || 'Erro de validação na TecnoSpeed'}:\n${formattedErrors}`;
                    } else if (innerMsg) {
                        displayMessage = innerMsg;
                    } else {
                        displayMessage = typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
                    }
                } else if (data.error) {
                    displayMessage = data.error;
                }
            }
            
            setFiscalStatus({
                status: 'error',
                message: displayMessage
            });
        } finally {
            setIsEmittingFiscal(null);
        }
    };

    const handleCheckFiscalStatus = async (quote: Quote) => {
        if (!quote.nfe_id || !currentEntity.id) return;

        setIsEmittingFiscal(quote.id);
        setFiscalStatus({ status: 'loading', message: 'Consultando status no SEFAZ...' });
        setShowFiscalModal(true);

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            const ids = quote.nfe_id.split(',');
            let combinedStatus = '';
            let detailedMsg = '';

            for (let i = 0; i < ids.length; i++) {
                const id = ids[i].trim();
                const result = await fiscalService.checkStatus(id, currentEntity.id, token);
                const status = (result.data?.status || result.status || 'processando').toUpperCase();
                
                if (i > 0) {
                    combinedStatus += ' / ';
                    detailedMsg += ' | ';
                }
                combinedStatus += status;
                detailedMsg += `Nota ${i+1}: ${status}`;
            }

            setFiscalStatus({
                status: 'success',
                message: `Status atual: ${detailedMsg}`
            });

            // Update local quote
            await supabase.from('quotes').update({
                nfe_status: combinedStatus.toLowerCase()
            }).eq('id', quote.id);

        } catch (error: any) {
            console.error('Erro status fiscal:', error);
            setFiscalStatus({
                status: 'error',
                message: error.response?.data?.error || error.message || 'Erro ao consultar status.'
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
        let result = quotes;

        if (viewMode === 'recovery') {
            result = result.filter(quote => quote.status === 'rejected' && quote.follow_up_date);
        } else if (!showAll) {
            result = result.filter(quote => {
                const quoteDate = new Date(quote.created_at).toISOString().split('T')[0];
                return quoteDate >= startDate && quoteDate <= endDate;
            });
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(quote =>
                quote.title.toLowerCase().includes(q) ||
                quote.contact?.name.toLowerCase().includes(q)
            );
        }

        return result;
    }, [quotes, startDate, endDate, showAll, viewMode, searchQuery]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(value);
    };

    const { totalValue, totalExpense, totalProfit } = useMemo(() => {
        return filteredQuotes.reduce((acc, quote) => {
            const amount = quote.total_amount || 0;
            const expense = quoteExpenses[quote.id] || 0;
            const profit = amount - expense;
            return {
                totalValue: acc.totalValue + amount,
                totalExpense: acc.totalExpense + expense,
                totalProfit: acc.totalProfit + profit
            };
        }, { totalValue: 0, totalExpense: 0, totalProfit: 0 });
    }, [filteredQuotes, quoteExpenses]);

    useEffect(() => {
        const fetchExpenses = async () => {
            const ids = filteredQuotes.map(q => q.id);
            if (ids.length > 0) {
                const map = await fetchTransactionsByQuoteIds(ids);
                setQuoteExpenses(map);
            } else {
                setQuoteExpenses({});
            }
        };
        fetchExpenses();
    }, [filteredQuotes, fetchTransactionsByQuoteIds]);


    const validatePaymentRequirements = (quote: Quote) => {
        const missing = [];
        const contact = quote.contact as any; // Force type to avoid build error with Vercel

        if (!contact?.tax_id) missing.push('CPF/CNPJ do Cliente');
        if (!contact?.phone) missing.push('Telefone do Cliente');
        if (!contact?.address?.street) missing.push('Endereço (Rua)');
        if (!contact?.address?.number) missing.push('Número do Endereço');

        return true;
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-700">
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
                <div className="text-left">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Orçamentos</h1>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Gestão de Propostas e Faturamento Comercial</p>
                </div>
                <div className="flex gap-3">
                    <Button 
                        onClick={() => navigate('/dashboard/quotes/new')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-2.5 shadow-md shadow-emerald-500/10 font-black uppercase tracking-widest text-xs flex items-center"
                    >
                        <Plus size={16} className="mr-1.5" />
                        Nova Proposta
                    </Button>
                </div>
            </div>

            {/* PREMIUM STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 px-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all group hover:scale-[1.01]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg group-hover:rotate-12 transition-transform">
                            <DollarSign size={16} />
                        </div>
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full">Proposto</span>
                    </div>
                    <div className="space-y-0.5 text-left">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider leading-none">Total em Propostas</h3>
                        <p className="text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter tabular-nums">{formatCurrency(totalValue)}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 px-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm transition-all group hover:scale-[1.01]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-lg group-hover:-rotate-12 transition-transform">
                            <Trash2 size={16} />
                        </div>
                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider bg-rose-50 dark:bg-rose-900/30 px-2.5 py-0.5 rounded-full">Despesas</span>
                    </div>
                    <div className="space-y-0.5 text-left">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider leading-none">Despesas Vinculadas</h3>
                        <p className="text-2xl font-black text-gray-900 dark:text-white italic tracking-tighter tabular-nums">{formatCurrency(totalExpense)}</p>
                    </div>
                </div>

                <div className="bg-emerald-600 p-4 px-5 rounded-2xl shadow-md shadow-emerald-600/10 transition-all group hover:scale-[1.01]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="p-1.5 bg-white/20 text-white rounded-lg group-hover:scale-110 transition-transform">
                            <Rocket size={16} />
                        </div>
                        <span className="text-[9px] font-black text-white uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">Líquido</span>
                    </div>
                    <div className="space-y-0.5 text-left">
                        <h3 className="text-xs font-black text-emerald-100 uppercase tracking-wider leading-none">Lucro Projetado</h3>
                        <p className="text-2xl font-black text-white italic tracking-tighter tabular-nums">{formatCurrency(totalProfit)}</p>
                    </div>
                </div>
            </div>

            {/* Search and Toggle Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
                <div className="relative flex-1 max-w-xl text-left">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Pesquisar propostas por título ou nome do cliente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl py-2.5 pl-11 pr-5 text-sm font-bold text-gray-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm outline-none"
                    />
                </div>
                <div className="flex bg-gray-50 dark:bg-slate-900 p-1 rounded-xl self-start sm:self-auto border border-gray-100 dark:border-slate-800">
                    <button
                        onClick={() => setViewMode('default')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'default' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-400'}`}
                    >
                        Propostas Ativas
                    </button>
                    <button
                        onClick={() => setViewMode('recovery')}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${viewMode === 'recovery' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-400'}`}
                    >
                        Recuperação
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            {viewMode === 'default' && (
                <div className="bg-white dark:bg-slate-800 p-4 px-5 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-4 shadow-sm">
                    <div className="flex-1 min-w-[280px] grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1 text-left">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Inicial</label>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setShowAll(false);
                                        updateFilters({ start: e.target.value, all: false });
                                    }}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl py-2 pl-10 pr-3 text-sm font-bold text-gray-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                                    disabled={showAll}
                                />
                            </div>
                        </div>
                        <div className="space-y-1 text-left">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Final</label>
                            <div className="relative">
                                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => {
                                        setEndDate(e.target.value);
                                        setShowAll(false);
                                        updateFilters({ end: e.target.value, all: false });
                                    }}
                                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl py-2 pl-10 pr-3 text-sm font-bold text-gray-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none"
                                    disabled={showAll}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-gray-100 dark:border-slate-800 cursor-pointer hover:bg-gray-100/70 transition-colors mt-4 md:mt-0">
                        <input
                            type="checkbox"
                            id="showAll"
                            checked={showAll}
                            onChange={(e) => {
                                setShowAll(e.target.checked);
                                updateFilters({ all: e.target.checked });
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                        />
                        <label htmlFor="showAll" className="text-xs font-black text-gray-500 uppercase tracking-widest cursor-pointer select-none">
                            Ver Histórico Completo
                        </label>
                    </div>
                </div>
            )}

            {isRefreshing && (
                <div className="flex items-center justify-center p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest animate-pulse">
                    <Loader2 className="mr-3 h-4 w-4 animate-spin" />
                    Sincronizando Orçamentos...
                </div>
            )}

            {filteredQuotes.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-md shadow-gray-200/10">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-slate-900 rounded-xl flex items-center justify-center mx-auto text-gray-300 mb-4">
                        <FileText size={32} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic mb-1">Nenhum orçamento encontrado</h3>
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest max-w-xs mx-auto mb-6">
                        {showAll ? "Puxa, você ainda não criou nenhuma proposta comercial." : "Nenhum orçamento localizado para este período."}
                    </p>
                    {showAll && (
                        <Button 
                            onClick={() => navigate('/dashboard/quotes/new')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-2.5 shadow-md shadow-emerald-500/10 font-black uppercase tracking-widest text-xs flex items-center"
                        >
                            <Plus size={16} className="mr-1.5" />
                            Criar Primeira Proposta
                        </Button>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-md shadow-gray-200/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Data de Emissão</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Cliente / Projeto</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Responsável</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Análise de Lucro</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Status</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                                {filteredQuotes.map((quote) => (
                                    <tr key={quote.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-all duration-300">
                                        <td className="py-3 px-6 whitespace-nowrap">
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-black text-gray-900 dark:text-white tracking-tighter italic">
                                                    {new Date(quote.created_at).toLocaleDateString()}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                    #{quote.quote_number || quote.id.slice(0, 8)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="flex flex-col text-left">
                                                <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight truncate max-w-[220px]">
                                                    {quote.contact?.name || 'Cliente Geral'}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 truncate max-w-[200px]">
                                                    {quote.title}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-gray-500 uppercase">
                                                    {members.find(m => m.user_id === quote.user_id)?.profile.full_name.charAt(0) || '?'}
                                                </div>
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                    {members.find(m => m.user_id === quote.user_id)?.profile.full_name.split(' ')[0] || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6 text-right whitespace-nowrap">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-2 leading-none">
                                                    <span className="text-sm font-black text-gray-900 dark:text-white italic tabular-nums">{formatCurrency(quote.total_amount)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest italic">Lucro:</span>
                                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                        {formatCurrency(quote.total_amount - (quoteExpenses[quote.id] || 0))}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm ${
                                                    quote.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    quote.status === 'sent' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    quote.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    'bg-gray-50 text-gray-600 border-gray-100'
                                                }`}>
                                                    {statusLabels[quote.status]}
                                                </span>
                                                {quote.status === 'approved' && quote.payment_status === 'pending' && (
                                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 animate-pulse">
                                                        Aguardando Pagamento
                                                    </span>
                                                )}
                                                {quote.status === 'approved' && quote.payment_status === 'paid' && (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                            Liquidação Confirmada
                                                        </span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleResetPayment(quote); }}
                                                            className="text-[8px] font-black text-gray-400 hover:text-rose-600 uppercase tracking-[0.2em] transition-colors"
                                                        >
                                                            [ Resetar ]
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-6 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Edit Button */}
                                                {(quote.status === 'draft' || quote.status === 'sent') && (
                                                    <Tooltip content="Editar Proposta">
                                                        <button
                                                            onClick={() => navigate(`/dashboard/quotes/${quote.id}`)}
                                                            className="p-1.5 bg-gray-50 dark:bg-slate-800 text-gray-400 hover:text-blue-600 rounded-lg transition-all shadow-sm"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {/* Action Buttons */}
                                                {(quote.status === 'draft' || quote.status === 'sent' || quote.status === 'approved') && (
                                                    <Tooltip content={quote.status === 'draft' ? 'Enviar Proposta' : 'Reenviar Proposta'}>
                                                        <button
                                                            onClick={async () => {
                                                                if (!quote.contact?.phone) {
                                                                    setWaTargetQuote(quote);
                                                                    setWaAction('proposal');
                                                                    setWaNumber('');
                                                                    setShowWAModal(true);
                                                                    return;
                                                                }
                                                                processSendProposal(quote);
                                                            }}
                                                            className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 transition-all shadow-sm disabled:opacity-50"
                                                            disabled={sendingProposal === quote.id}
                                                        >
                                                            {sendingProposal === quote.id ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <Send size={14} />
                                                            )}
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {/* Fiscal Module Integration */}
                                                {quote.status === 'approved' && currentCompany?.fiscal_module_enabled && (
                                                    <div className="flex items-center gap-1">
                                                        <Tooltip content={quote.nfe_id ? `NF: ${quote.nfe_status || 'Pendente'}` : "Emitir NF-e"}>
                                                            <button
                                                                onClick={() => quote.nfe_id ? handleCheckFiscalStatus(quote) : handleEmitFiscal(quote)}
                                                                className={`p-1.5 rounded-lg transition-all shadow-sm ${quote.nfe_id
                                                                    ? (quote.nfe_status === 'concluido' || quote.nfe_status === 'autorizado'
                                                                        ? 'bg-emerald-50 text-emerald-600'
                                                                        : 'bg-amber-50 text-amber-600')
                                                                    : 'bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-600'
                                                                    }`}
                                                                disabled={isEmittingFiscal === quote.id}
                                                            >
                                                                {isEmittingFiscal === quote.id ? (
                                                                    <Loader2 size={14} className="animate-spin" />
                                                                ) : (
                                                                    <FileText size={14} />
                                                                )}
                                                            </button>
                                                        </Tooltip>
                                                    </div>
                                                )}

                                                {/* Approval / Payment Action */}
                                                {quote.status !== 'approved' && quote.status !== 'rejected' && (
                                                    <Tooltip content="Aprovar Proposta">
                                                        <button
                                                            onClick={() => handleApproveClick(quote)}
                                                            className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all shadow-sm"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {/* Payment Link Generation / Settle */}
                                                {quote.status === 'approved' && quote.payment_status !== 'paid' && (
                                                    <Tooltip content="Pagamento / Link">
                                                        <button
                                                            onClick={async () => handleApproveClick(quote)}
                                                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/10"
                                                        >
                                                            <CreditCard size={14} />
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {/* Recovery Actions */}
                                                {quote.status === 'rejected' && (
                                                    <Tooltip content="Recuperar / Agendar">
                                                        <button
                                                            onClick={() => handleOpenRecovery(quote)}
                                                            className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-all shadow-sm"
                                                        >
                                                            <CalendarClock size={14} />
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {/* Copy Link Button */}
                                                <Tooltip content="Copiar Link Proposta">
                                                    <button
                                                        onClick={() => {
                                                            const url = `${window.location.origin}/p/${quote.id}`;
                                                            navigator.clipboard.writeText(url);
                                                            notify('success', 'Copiado', 'Link da proposta copiado!');
                                                        }}
                                                        className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all shadow-sm"
                                                    >
                                                        <Rocket size={14} />
                                                    </button>
                                                </Tooltip>

                                                {/* Print Button */}
                                                <Tooltip content="Imprimir">
                                                    <button
                                                        onClick={() => navigate(`/dashboard/quotes/${quote.id}/print`)}
                                                        className="p-1.5 bg-gray-50 dark:bg-slate-800 text-gray-400 hover:text-gray-600 rounded-lg transition-all shadow-sm"
                                                    >
                                                        <Printer size={14} />
                                                    </button>
                                                </Tooltip>

                                                {/* Delete Button */}
                                                <Tooltip content="Excluir">
                                                    <button
                                                        onClick={() => handleDelete(quote)}
                                                        className="p-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-400 hover:text-rose-600 rounded-lg transition-all shadow-sm"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Approval Options Modal */}
            {
                showApprovalOptions && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md animate-in fade-in slide-in-from-bottom-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                {quoteToApprove?.status === 'approved' ? 'Lançar no Financeiro' : 'Aprovar Orçamento'}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 mb-6">
                                O orçamento será marcado como <span className="font-bold text-green-600">Aprovado</span>. O que você deseja fazer em seguida?
                            </p>

                            <div className="flex flex-col gap-3">
                                {waInstances.length === 0 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2 flex items-start gap-2">
                                        <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                                        <p className="text-xs text-amber-700">
                                            <strong>WhatsApp Desconectado:</strong> Você poderá gerar o link, mas o envio automático não funcionará até que você conecte uma instância.
                                        </p>
                                    </div>
                                )}

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
                                            setChargeToReuse(existingCharge);
                                            setReuseConfirmOpen(true);
                                            return;
                                        }

                                        // 1. Approve (generate pending transaction)
                                        await approveQuote(quoteToApprove.id, {
                                            generateTransaction: true,
                                            transactionStatus: 'pending'
                                        });

                                        // 2. Generate Charge
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
                    <div className="flex items-center gap-8">
                        <div className="text-right">
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 block uppercase tracking-wider font-bold mb-0.5">Total Bruto</span>
                            <span className="text-lg font-bold text-gray-900 dark:text-white leading-none">{formatCurrency(totalValue)}</span>
                        </div>
                        
                        <div className="text-right">
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 block uppercase tracking-wider font-bold mb-0.5">Despesas</span>
                            <span className="text-lg font-bold text-red-500 leading-none">-{formatCurrency(totalExpense)}</span>
                        </div>

                        <div className="flex items-center gap-6 bg-gray-50 dark:bg-slate-700/50 px-6 py-2.5 rounded-2xl border border-gray-100 dark:border-slate-700">
                            <div className="text-right">
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 block uppercase tracking-[0.2em] font-black">Lucro Líquido Real</span>
                                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm">
                                    {formatCurrency(totalProfit)}
                                </span>
                            </div>
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

                        {/* Resumo Fiscal da Empresa */}
                        {currentCompany?.tecnospeed_config && (
                            <div className="space-y-3 mb-6">
                                {currentCompany.tecnospeed_config.nfse?.config?.nfseNacional && (
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-2xl border border-blue-100 dark:border-blue-900/20 flex items-center gap-3">
                                        <Globe size={14} className="text-blue-600 dark:text-blue-400" />
                                        <p className="text-[10px] font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wider">Padrão Nacional Ativo</p>
                                    </div>
                                )}
                                
                                <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2 mb-3">
                                        <ShieldCheck size={14} className="text-blue-500" />
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Configuração Fiscal Ativa:</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                            <span className="text-[9px] font-medium text-gray-400 block mb-0.5">CNAE Principal</span>
                                            <span className="text-xs font-black text-gray-700 dark:text-white tracking-tight">
                                                {currentCompany.tecnospeed_config.default_cnae || (currentCompany.tecnospeed_config.ambiente === 'homologacao' ? '7490104' : 'N/A')}
                                            </span>
                                        </div>
                                        <div className="px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                            <span className="text-[9px] font-medium text-gray-400 block mb-0.5">Alíquota ISS</span>
                                            <span className="text-xs font-black text-gray-700 dark:text-white tracking-tight">
                                                {currentCompany.tecnospeed_config.default_iss_aliquota || (currentCompany.tecnospeed_config.ambiente === 'homologacao' ? '3' : '0')}%
                                            </span>
                                        </div>
                                        <div className="col-span-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                            <span className="text-[9px] font-medium text-gray-400 block mb-0.5">Exigibilidade</span>
                                            <span className="text-xs font-black text-gray-700 dark:text-white uppercase tracking-tighter">
                                                {currentCompany.tecnospeed_config.default_iss_exigibilidade === '1' ? 'Exigível' : 
                                                 currentCompany.tecnospeed_config.default_iss_exigibilidade === '2' ? 'Não Incidência' :
                                                 currentCompany.tecnospeed_config.default_iss_exigibilidade === '3' ? 'Isenção' :
                                                 currentCompany.tecnospeed_config.default_iss_exigibilidade === '4' ? 'Exportação' :
                                                 currentCompany.tecnospeed_config.default_iss_exigibilidade === '5' ? 'Imunidade' :
                                                 currentCompany.tecnospeed_config.default_iss_exigibilidade === '6' ? 'Suspensa (Judicial)' :
                                                 currentCompany.tecnospeed_config.default_iss_exigibilidade === '7' ? 'Suspensa (Administrativo)' : 'Exigível'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 py-4">
                            {loadingQuoteDetails ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                    <Loader2 size={36} className="animate-spin text-blue-500" />
                                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Analisando itens do orçamento...</p>
                                </div>
                            ) : (
                                <>
                                    {fiscalStatus.status === 'idle' && (
                                        <div className="space-y-4">
                                            {/* Multi-serviços Selector UI */}
                                            {(() => {
                                                const isServiceOnly = fullFiscalQuote?.items?.every((item: any) => item.service_id);
                                                const hasMultipleServices = fullFiscalQuote?.items?.length > 1;
                                                const isNacional = (currentCompany?.tecnospeed_config as any)?.nfse_nacional || false;
                                                const showStrategyChoice = isServiceOnly && hasMultipleServices && isNacional;

                                                if (!showStrategyChoice) return null;

                                                return (
                                                    <div className="bg-amber-50 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl mb-4">
                                                        <div className="flex gap-2 items-start mb-3">
                                                            <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                                                            <div>
                                                                <p className="text-xs font-black text-amber-900 dark:text-amber-400 uppercase tracking-wider">Multi-Serviços Detectados (NFS-e Nacional)</p>
                                                                <p className="text-[10px] text-amber-700 dark:text-amber-500 mt-0.5 leading-relaxed">
                                                                    A Receita Federal proíbe mais de um item de serviço na mesma nota fiscal. Escolha a sua estratégia de emissão:
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 gap-2.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setEmissionStrategy('group')}
                                                                className={`flex gap-3 items-center p-3 rounded-xl border text-left transition-all ${
                                                                    emissionStrategy === 'group'
                                                                        ? 'border-blue-500 bg-blue-50/55 dark:bg-blue-900/10 shadow-md ring-1 ring-blue-500'
                                                                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                                                                }`}
                                                            >
                                                                <div className={`p-2 rounded-lg ${emissionStrategy === 'group' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 dark:bg-slate-700'}`}>
                                                                    <Globe size={18} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-xs font-bold text-gray-800 dark:text-white">Agrupar em 1 Única Nota</span>
                                                                        <span className="text-[8px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded-full uppercase">Recomendado</span>
                                                                    </div>
                                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-snug">
                                                                        Soma todos os serviços em 1 atividade consolidada. Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fullFiscalQuote?.total_amount || 0)}
                                                                    </span>
                                                                </div>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => setEmissionStrategy('split')}
                                                                className={`flex gap-3 items-center p-3 rounded-xl border text-left transition-all ${
                                                                    emissionStrategy === 'split'
                                                                        ? 'border-blue-500 bg-blue-50/55 dark:bg-blue-900/10 shadow-md ring-1 ring-blue-500'
                                                                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                                                                }`}
                                                            >
                                                                <div className={`p-2 rounded-lg ${emissionStrategy === 'split' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500 dark:bg-slate-700'}`}>
                                                                    <Rocket size={18} />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="text-xs font-bold text-gray-800 dark:text-white block">Desmembrar em {fullFiscalQuote?.items?.length} Notas Fiscais</span>
                                                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5 leading-snug">
                                                                        Gera e emite {fullFiscalQuote?.items?.length} notas individuais consecutivas (uma para cada item de serviço).
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/20">
                                                <p className="text-xs text-blue-900 dark:text-blue-400 font-medium mb-4">
                                                    Deseja automatizar o envio após a emissão?
                                                </p>
                                                <div className="space-y-3">
                                                    <label className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={`p-2 rounded-lg transition-colors ${sendEmail ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                                            <Mail size={18} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Enviar por E-mail</p>
                                                            <p className="text-[10px] text-gray-500">O PDF e XML serão enviados automaticamente</p>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={sendEmail}
                                                            onChange={(e) => setSendEmail(e.target.checked)}
                                                            className="w-5 h-5 rounded-lg border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                    </label>

                                                    <label className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={`p-2 rounded-lg transition-colors ${sendWhatsApp ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                                            <MessageCircle size={18} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">Notificar via WhatsApp</p>
                                                            <p className="text-[10px] text-gray-500">Enviar link da nota via Evolution API</p>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={sendWhatsApp}
                                                            onChange={(e) => setSendWhatsApp(e.target.checked)}
                                                            className="w-5 h-5 rounded-lg border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                                        />
                                                    </label>
                                                </div>
                                            </div>

                                            <Button 
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-2xl shadow-lg shadow-blue-500/20 font-bold"
                                                onClick={() => fiscalQuote && executeEmitFiscal(fiscalQuote)}
                                            >
                                                <Rocket className="mr-2" size={20} />
                                                {(() => {
                                                    const isServiceOnly = fullFiscalQuote?.items?.every((item: any) => item.service_id);
                                                    const hasMultipleServices = fullFiscalQuote?.items?.length > 1;
                                                    const isNacional = (currentCompany?.tecnospeed_config as any)?.nfse_nacional || false;
                                                    if (isServiceOnly && hasMultipleServices && isNacional) {
                                                        return emissionStrategy === 'group' 
                                                            ? 'Confirmar e Emitir Nota Consolidada' 
                                                            : `Confirmar e Emitir ${fullFiscalQuote?.items?.length} Notas Separadas`;
                                                    }
                                                    return 'Confirmar e Emitir Nota Fiscal';
                                                })()}
                                            </Button>
                                        </div>
                                    )}

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
                                </>
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
                                if (!quote) return;
                                
                                if (!quote.contact?.phone) {
                                    setWaTargetQuote(quote);
                                    setWaAction('payment');
                                    setWaNumber('');
                                    setShowWAModal(true);
                                    return;
                                }
                                handleSendWhatsApp(quote, paymentResult);
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

            {/* WhatsApp Missing Number Modal */}
            <Modal
                isOpen={showWAModal}
                onClose={() => setShowWAModal(false)}
                title="Telefone Faltando"
                icon={Send}
                maxWidth="max-w-sm"
            >
                <div className="py-4 space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                            O contato <strong>{waTargetQuote?.contact?.name}</strong> não possui um número de telefone cadastrado para o envio via WhatsApp.
                        </p>
                    </div>

                    <Input
                        label="Número do WhatsApp"
                        value={waNumber}
                        onChange={(e) => {
                            // Basic mask to help user
                            const val = e.target.value.replace(/\D/g, '');
                            setWaNumber(val);
                        }}
                        placeholder="EX: 5584999999999"
                        autoFocus
                    />

                    <p className="text-[10px] text-gray-500 italic">
                        * O número será salvo permanentemente no cadastro do contato.
                    </p>

                    <div className="flex gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => setShowWAModal(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={handleSaveWhatsApp}
                            disabled={isSavingWA || waNumber.length < 10}
                        >
                            {isSavingWA ? <Loader2 className="animate-spin" size={18} /> : 'Salvar e Enviar'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Modals Section */}
            <ConfirmationModal
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setQuoteToDelete(null);
                }}
                onConfirm={executeDelete}
                title="Excluir Orçamento"
                message={`Tem certeza que deseja excluir o orçamento de ${quoteToDelete?.contact?.name}? Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                variant="danger"
            />

            <ConfirmationModal
                isOpen={resetConfirmOpen}
                onClose={() => {
                    setResetConfirmOpen(false);
                    setQuoteToReset(null);
                }}
                onConfirm={executeResetPayment}
                title="Resetar Pagamento"
                message="Deseja realmente resetar o status de pagamento deste orçamento? O lançamento financeiro vinculado continuará existindo, mas o orçamento voltará ao estado pendente."
                confirmLabel="Resetar"
                variant="warning"
            />

            <ConfirmationModal
                isOpen={reuseConfirmOpen}
                onClose={() => {
                    setReuseConfirmOpen(false);
                    setChargeToReuse(null);
                }}
                onConfirm={async () => {
                    if (chargeToReuse && quoteToApprove) {
                        // Approve without generating new transaction/charge
                        await approveQuote(quoteToApprove.id, {
                            generateTransaction: false
                        });

                        setPaymentResult({
                            success: true,
                            payment_link: chargeToReuse.payment_link,
                            qr_code_base64: chargeToReuse.qr_code_base64,
                            quote_id: quoteToApprove.id
                        });
                        setReuseConfirmOpen(false);
                        setChargeToReuse(null);
                        closeModals();
                    }
                }}
                title="Link Existente"
                message="Já existe um link de pagamento pendente para este orçamento. Deseja REUTILIZAR o link atual? Se desejar gerar um novo link, você deve primeiro excluir a cobrança anterior na aba Pagamentos."
                confirmLabel="Reutilizar Link"
                variant="primary"
            />

            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal({ ...resultModal, isOpen: false })}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
            />
        </div>
    );
}
