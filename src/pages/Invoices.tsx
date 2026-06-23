import { useState } from 'react';
import { Receipt, Plus, FileText, Download, AlertCircle, RefreshCw, Building2, Eye, FileCode, CheckCircle2, Clock3, XCircle, Trash2, Copy, AlertTriangle, ExternalLink, Search, MessageCircle, Mail, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../components/ui/Button';
import { useInvoices } from '../hooks/useInvoices';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { fiscalService } from '../services/fiscalService';
import { whatsappService } from '../services/whatsappService';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/constants';
import { StandaloneInvoiceModal } from '../components/fiscal/StandaloneInvoiceModal';
import { ConsultaNotasModal } from '../components/fiscal/ConsultaNotasModal';
import { ResultModal } from '../components/ui/ResultModal';
import { Tooltip } from '../components/ui/Tooltip';
import { Modal } from '../components/ui/Modal';
import { InvoiceDetailModal } from '../components/fiscal/InvoiceDetailModal';
import { BillingReportModal } from '../components/fiscal/BillingReportModal';
import { DeleteProtectionModal } from '../components/transactions/DeleteProtectionModal';
import { getInvoiceFilename } from '../utils/invoiceUtils';


export function parseFiscalError(error: any): string {
    const errData = error.response?.data;
    if (errData && typeof errData === 'object') {
        const detail = errData.detail;
        
        // Se houver detalhe estruturado do erro
        if (detail && typeof detail === 'object') {
            // Caso 1: NFe.io indisponível (503)
            if (detail.status === 503 || detail.title === 'Service Unavailable') {
                return 'O provedor fiscal NFe.io está temporariamente indisponível (Erro 503 Service Unavailable). Por favor, aguarde alguns minutos e tente novamente.';
            }
            
            // Caso 2: Mensagem direta do NFe.io ou erro interno
            if (detail.message) {
                return `Erro no provedor fiscal (NFe.io): ${detail.message}`;
            }

            // Caso 3: Erro detalhado da PlugNotas/Prefeitura
            if (detail.error && typeof detail.error === 'object') {
                if (detail.error.message) {
                    return `Erro do provedor fiscal: ${detail.error.message}`;
                }
                if (detail.error.errors && Array.isArray(detail.error.errors) && detail.error.errors[0]?.message) {
                    return `Erro da prefeitura: ${detail.error.errors[0].message}`;
                }
            }

            // Caso 4: Erro dentro do detail.error.message (Ex: prefeitura rejeitou)
            if (typeof detail.error === 'string') {
                return `Erro do provedor: ${detail.error}`;
            }
        }

        if (typeof detail === 'string') {
            return detail;
        }

        // Se houver erro direto (PlugNotas/Backend)
        const errorField = errData.error;
        if (errorField && typeof errorField === 'object' && errorField.message) {
            return errorField.message;
        }

        if (typeof errorField === 'string' && errorField !== 'Erro ao cancelar nota') {
            return errorField;
        }

        if (errData.message) {
            return errData.message;
        }
    }

    if (error.message === 'Network Error') {
        return 'Falha de conexão com o servidor. Verifique sua conexão de rede.';
    }

    return error.message || 'Ocorreu um erro desconhecido no cancelamento.';
}

export function Invoices() {
    const { invoices, isLoading, refresh } = useInvoices();
    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    
    const currentCompany = companies.find(c => c.id === currentEntity.id);
    const activeProvider = currentCompany?.settings?.fiscal_provider || 'tecnospeed';
    const config = activeProvider === 'nfeio'
        ? {
            ...currentCompany?.settings?.nfeio_config,
            send_whatsapp_automatically: currentCompany?.tecnospeed_config?.send_whatsapp_automatically,
            send_email_automatically: currentCompany?.tecnospeed_config?.send_email_automatically
          }
        : currentCompany?.tecnospeed_config;
    
    const [showNewModal, setShowNewModal] = useState(false);
    const [showConsultaModal, setShowConsultaModal] = useState(false);
    const [showBillingModal, setShowBillingModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
    const [showDeleted, setShowDeleted] = useState(false);
    const [resultModal, setResultModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info', data?: any}>({
        isOpen: false, title: '', message: '', type: 'success'
    });
    const [cancelModal, setCancelModal] = useState<{isOpen: boolean, invoice: any | null}>({ isOpen: false, invoice: null });
    const [cancelReason, setCancelReason] = useState('');
    const [isProtectedModalOpen, setIsProtectedModalOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, invoiceId: string | null}>({
        isOpen: false, invoiceId: null
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [duplicateData, setDuplicateData] = useState<{items: any[], type: 'nfse' | 'nfe', contactId: string, cityCode: string, notes: string} | null>(null);
    const [sendModal, setSendModal] = useState<{
        isOpen: boolean;
        invoice: any | null;
        type: 'whatsapp' | 'email';
        recipient: string;
        message: string;
        isLoading: boolean;
    }>({
        isOpen: false,
        invoice: null,
        type: 'whatsapp',
        recipient: '',
        message: '',
        isLoading: false
    });
    const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<any | null>(null);



    const filteredInvoices = invoices.filter(invoice => {
        if (invoice.deleted && !showDeleted) return false;
        if (!searchQuery) return true;
        const searchLower = searchQuery.toLowerCase().trim();
        
        const clientNameQuote = invoice.quote?.contact?.name || '';
        const clientNamePayloadNfe = invoice.payload?.destinatario?.nome || '';
        const clientNamePayloadNfse = invoice.payload?.tomador?.razaoSocial || invoice.payload?.tomador?.nome || '';
        const clientNamePayloadBorrower = invoice.payload?.borrower?.name || invoice.payload?.retorno?.borrower?.name || '';
        const clientName = (clientNameQuote || clientNamePayloadNfe || clientNamePayloadNfse || clientNamePayloadBorrower || 'Cliente Desconhecido').toLowerCase();
        
        const invoiceNumber = String(invoice.invoice_number || '').toLowerCase();
        const payloadNumber = String(invoice.payload?.numero || invoice.payload?.retorno?.numeroNfse || invoice.payload?.numeroNfse || invoice.payload?.numeroNfe || invoice.payload?.retorno?.numero || invoice.payload?.retorno?.dps?.numero || '').toLowerCase();
        const dpsNumber = String(invoice.dps_number || '').toLowerCase();
        const externalId = String(invoice.external_id || '').toLowerCase();
        
        const status = String(invoice.status || '').toLowerCase();
        const type = String(invoice.type || '').toLowerCase();
        
        return clientName.includes(searchLower) ||
               invoiceNumber.includes(searchLower) ||
               payloadNumber.includes(searchLower) ||
               dpsNumber.includes(searchLower) ||
               externalId.includes(searchLower) ||
               status.includes(searchLower) ||
               type.includes(searchLower);
    });



    const handleDownloadPDF = async (invoice: any) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            const blob = await fiscalService.downloadPDF(invoice.external_id, invoice.type, invoice.company_id, token);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const company = companies.find(c => c.id === invoice.company_id) || currentCompany;
            a.download = getInvoiceFilename(invoice, 'pdf', company);
            a.click();
        } catch (error) {
            console.error('Erro ao baixar PDF:', error);
            setResultModal({
                isOpen: true,
                title: 'Erro no Download',
                message: 'Não foi possível baixar o PDF desta nota fiscal. Tente novamente mais tarde.',
                type: 'error'
            });
        }
    };

    const handleDownloadXML = async (invoice: any) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            const blob = await fiscalService.downloadXML(invoice.external_id, invoice.type, invoice.company_id, token);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const company = companies.find(c => c.id === invoice.company_id) || currentCompany;
            a.download = getInvoiceFilename(invoice, 'xml', company);
            a.click();
        } catch (error) {
            console.error('Erro ao baixar XML:', error);
            setResultModal({
                isOpen: true,
                title: 'Erro no Download',
                message: 'Não foi possível baixar o XML desta nota fiscal. Tente novamente mais tarde.',
                type: 'error'
            });
        }
    };

    const handleRefreshStatus = async (invoice: any) => {
        if (!invoice.external_id || !currentEntity.id) return;
        setIsRefreshing(invoice.id);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            await fiscalService.checkStatus(invoice.external_id, currentEntity.id, token);
            await refresh();
        } catch (error: any) {
            console.error('Error checking status:', error);
            setResultModal({
                isOpen: true,
                title: 'Erro na Sincronização',
                message: error.message || 'Falha ao atualizar o status da nota na TecnoSpeed.',
                type: 'error'
            });
        } finally {
            setIsRefreshing(null);
        }
    };

    const executeCancelInvoice = async () => {
        if (!cancelModal.invoice || !cancelReason.trim() || !currentEntity.id) return;
        setIsCancelling(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            await fiscalService.cancelarNota(
                cancelModal.invoice.external_id,
                cancelModal.invoice.type,
                currentEntity.id,
                cancelReason,
                token
            );

            setResultModal({
                isOpen: true,
                title: 'Cancelamento Solicitado',
                message: 'A solicitação de cancelamento foi enviada com sucesso.',
                type: 'success'
            });
            setCancelModal({ isOpen: false, invoice: null });
            setCancelReason('');
            refresh();
        } catch (error: any) {
            console.error('Error cancelling invoice:', error);
            setResultModal({
                isOpen: true,
                title: 'Erro no Cancelamento',
                message: parseFiscalError(error),
                type: 'error'
            });
            throw error;
        } finally {
            setIsCancelling(false);
        }
    };

    const handleCancelInvoice = async () => {
        if (!cancelModal.invoice || !cancelReason.trim() || !currentEntity.id) return;

        const isAuthorized = ['concluido', 'autorizado'].includes(cancelModal.invoice.status?.toLowerCase());

        // Se a nota estiver concluída/autorizada, exige validação do administrador via DeleteProtectionModal
        if (isAuthorized) {
            setCancelModal(prev => ({ ...prev, isOpen: false }));
            setIsProtectedModalOpen(true);
            return;
        }

        await executeCancelInvoice();
    };



    const handleDeleteInvoice = async () => {
        if (!deleteModal.invoiceId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('fiscal_invoices').update({ deleted: true }).eq('id', deleteModal.invoiceId);
            if (error) throw error;
            
            setDeleteModal({ isOpen: false, invoiceId: null });
            refresh();
        } catch (error: any) {
            alert('Erro ao ocultar nota do histórico: ' + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDuplicateInvoice = (invoice: any) => {
        const payload = invoice.payload;
        if (!payload) return;

        // Tentar extrair dados do payload (NFSe ou NFe)
        const items = (payload.servico || payload.itens || []).map((i: any) => ({
            id: crypto.randomUUID(),
            description: i.discriminacao || i.descricao || '',
            amount: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(i.valor?.servico || i.valorUnitario?.comercial || 0),
            quantity: i.quantidade?.comercial || i.quantidade || 1,
            taxCode: i.codigo || '',
            taxationCode: i.codigoTributacao || i.ncm || '',
            codigoTributacaoNacional: i.codigoTributacaoNacional || ''
        }));

        setDuplicateData({
            items,
            type: invoice.type,
            contactId: invoice.quote?.contact?.id || '', // Pode estar faltando se não veio via orçamento
            cityCode: payload.tomador?.endereco?.codigoCidade || payload.destinatario?.endereco?.codigoCidade || '',
            notes: payload.informacoesComplementares?.replace(/\|/g, '\n') || ''
        });
        setShowNewModal(true);
    };

    const handleViewInternal = (invoice: any) => {
        setSelectedInvoiceDetail(invoice);
    };

    const getPhoneFromPayload = (invoice: any): string => {
        const contactPhone = invoice.quote?.contact?.whatsapp || invoice.quote?.contact?.phone;
        if (contactPhone) {
            return String(contactPhone).replace(/\D/g, '');
        }

        const p = invoice.payload;
        if (!p) return '';

        const targets = [
            p?.tomador?.telefone,
            p?.tomador?.contato?.telefone,
            p?.destinatario?.telefone,
            p?.destinatario?.contato?.telefone,
            p?.retorno?.tomador?.telefone,
            p?.retorno?.destinatario?.telefone,
            p?.borrower?.phone,
            p?.borrower?.telefone,
            p?.borrower?.phone_number,
            p?.retorno?.borrower?.phone,
            p?.retorno?.borrower?.telefone
        ];

        for (const t of targets) {
            if (!t) continue;
            if (typeof t === 'string') {
                const clean = t.replace(/\D/g, '');
                if (clean) return clean;
            }
            if (typeof t === 'object') {
                const ddd = String(t.ddd || '').replace(/\D/g, '');
                const num = String(t.numero || '').replace(/\D/g, '');
                if (num) return `${ddd}${num}`;
            }
        }
        return '';
    };

    const getEmailFromPayload = (invoice: any): string => {
        if (invoice.quote?.contact?.email) {
            return String(invoice.quote.contact.email).trim();
        }

        const p = invoice.payload;
        if (!p) return '';

        const targets = [
            p?.tomador?.email,
            p?.tomador?.contato?.email,
            p?.destinatario?.email,
            p?.destinatario?.contato?.email,
            p?.retorno?.tomador?.email,
            p?.retorno?.destinatario?.email,
            p?.borrower?.email,
            p?.retorno?.borrower?.email
        ];

        for (const t of targets) {
            if (typeof t === 'string' && t.trim()) {
                return t.trim();
            }
        }
        return '';
    };

    const getPdfUrlFromInvoice = (invoice: any): string => {
        if (invoice.pdf_url && invoice.pdf_url.startsWith('http')) {
            return invoice.pdf_url;
        }
        
        const p = invoice.payload;
        if (p) {
            const paths = [
                p?.pdf,
                p?.pdfUrl,
                p?.link,
                p?.linkPdf,
                p?.retorno?.pdf,
                p?.retorno?.pdfUrl,
                p?.retorno?.link,
                p?.retorno?.linkPdf
            ];
            for (const path of paths) {
                if (typeof path === 'string' && path.startsWith('http')) {
                    return path;
                }
            }
        }

        let apiBase = API_BASE_URL.replace(/\/$/, '');
        if (apiBase.startsWith('/')) {
            apiBase = window.location.origin + apiBase;
        }
        return `${apiBase}/fiscal-module/${invoice.type}/${invoice.external_id}/pdf?companyId=${invoice.company_id}`;
    };

    const handleOpenSendWhatsApp = async (invoice: any) => {
        const phone = getPhoneFromPayload(invoice);
        const pdfUrl = getPdfUrlFromInvoice(invoice);
        const p = invoice.payload;
        const clientName = invoice.quote?.contact?.name || 
                           p?.tomador?.razaoSocial || 
                           p?.destinatario?.nome || 
                           'Cliente';

        setSendModal({
            isOpen: true,
            invoice,
            type: 'whatsapp',
            recipient: phone,
            message: `Olá, *${clientName}*! 👋\n\nSua Nota Fiscal foi emitida com sucesso.\nClique no link abaixo para visualizar e baixar o documento:\n\n${pdfUrl}`,
            isLoading: false
        });

        // Se for emissão direta (sem orçamento) e tiver CPF/CNPJ do tomador, tenta buscar o contato no banco de dados para puxar o WhatsApp/Telefone atualizado
        if (!invoice.quote && p) {
            const rawCpfCnpj = p?.tomador?.cpfCnpj || p?.tomador?.cnpj || p?.destinatario?.cpfCnpj || p?.destinatario?.cnpj || p?.borrower?.federalTaxNumber || p?.retorno?.borrower?.federalTaxNumber;
            if (rawCpfCnpj) {
                const cleanCpfCnpj = String(rawCpfCnpj).replace(/\D/g, '');
                const formattedCpfCnpj = cleanCpfCnpj.length === 11 
                    ? cleanCpfCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                    : cleanCpfCnpj.length === 14 
                        ? cleanCpfCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
                        : cleanCpfCnpj;

                try {
                    const { data, error } = await supabase
                        .from('contacts')
                        .select('phone, whatsapp')
                        .in('tax_id', [cleanCpfCnpj, rawCpfCnpj, formattedCpfCnpj])
                        .limit(1);

                    if (!error && data && data.length > 0) {
                        const contact = data[0];
                        const resolvedPhone = contact.whatsapp || contact.phone;
                        if (resolvedPhone) {
                            const cleanPhone = String(resolvedPhone).replace(/\D/g, '');
                            setSendModal(prev => {
                                if (prev.isOpen && prev.invoice?.id === invoice.id && prev.type === 'whatsapp') {
                                    return { ...prev, recipient: cleanPhone };
                                }
                                return prev;
                            });
                        }
                    }
                } catch (err) {
                    console.warn('Erro ao carregar contato do banco:', err);
                }
            }
        }
    };

    const handleOpenSendEmail = async (invoice: any) => {
        const email = getEmailFromPayload(invoice);
        setSendModal({
            isOpen: true,
            invoice,
            type: 'email',
            recipient: email,
            message: '',
            isLoading: false
        });

        // Se for emissão direta (sem orçamento) e tiver CPF/CNPJ do tomador, tenta buscar o contato no banco de dados para puxar o E-mail atualizado
        const p = invoice.payload;
        if (!invoice.quote && p) {
            const rawCpfCnpj = p?.tomador?.cpfCnpj || p?.tomador?.cnpj || p?.destinatario?.cpfCnpj || p?.destinatario?.cnpj || p?.borrower?.federalTaxNumber || p?.retorno?.borrower?.federalTaxNumber;
            if (rawCpfCnpj) {
                const cleanCpfCnpj = String(rawCpfCnpj).replace(/\D/g, '');
                const formattedCpfCnpj = cleanCpfCnpj.length === 11 
                    ? cleanCpfCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                    : cleanCpfCnpj.length === 14 
                        ? cleanCpfCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
                        : cleanCpfCnpj;

                try {
                    const { data, error } = await supabase
                        .from('contacts')
                        .select('email')
                        .in('tax_id', [cleanCpfCnpj, rawCpfCnpj, formattedCpfCnpj])
                        .limit(1);

                    if (!error && data && data.length > 0) {
                        const contact = data[0];
                        if (contact.email) {
                            setSendModal(prev => {
                                if (prev.isOpen && prev.invoice?.id === invoice.id && prev.type === 'email') {
                                    return { ...prev, recipient: contact.email.trim() };
                                }
                                return prev;
                            });
                        }
                    }
                } catch (err) {
                    console.warn('Erro ao carregar contato do banco:', err);
                }
            }
        }
    };

    const handleSendDocument = async () => {
        if (!sendModal.recipient) {
            alert('Por favor, informe o destinatário.');
            return;
        }

        setSendModal(prev => ({ ...prev, isLoading: true }));
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada. Por favor, faça login novamente.');

            if (sendModal.type === 'whatsapp') {
                const { data: waData } = await supabase
                    .from('instances')
                    .select('*')
                    .eq('status', 'connected')
                    .eq('company_id', sendModal.invoice.company_id);

                if (!waData || waData.length === 0) {
                    throw new Error('Nenhuma instância de WhatsApp conectada e ativa encontrada para sua empresa. Conecte uma na aba WhatsApp.');
                }

                const instance = waData[0];
                const pdfUrl = getPdfUrlFromInvoice(sendModal.invoice);
                const hasPublicPdf = pdfUrl && pdfUrl.startsWith('http');

                await whatsappService.sendMessage({
                    instanceName: instance.instance_name,
                    number: sendModal.recipient,
                    text: sendModal.message,
                    mediaUrl: hasPublicPdf ? pdfUrl : undefined,
                    mediaType: 'document',
                    mimetype: 'application/pdf',
                    fileName: `NotaFiscal-${sendModal.invoice.external_id || 'avulsa'}.pdf`
                });

                setResultModal({
                    isOpen: true,
                    title: 'Disparo Concluído',
                    message: 'A nota fiscal foi enviada via WhatsApp com sucesso!',
                    type: 'success'
                });
            } else {
                await fiscalService.resendEmail(
                    sendModal.invoice.external_id,
                    sendModal.invoice.type,
                    sendModal.invoice.company_id,
                    [sendModal.recipient],
                    session.access_token
                );

                setResultModal({
                    isOpen: true,
                    title: 'Disparo Concluído',
                    message: 'O e-mail contendo o PDF e XML foi enviado com sucesso via PlugNotas!',
                    type: 'success'
                });
            }
            setSendModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
            console.error('Erro ao enviar documento:', err);
            setResultModal({
                isOpen: true,
                title: 'Erro no Envio',
                message: err.message || 'Ocorreu um erro ao tentar enviar o documento.',
                type: 'error'
            });
        } finally {
            setSendModal(prev => ({ ...prev, isLoading: false }));
        }
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase();
        if (s === 'concluido' || s === 'autorizado') {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 shadow-sm shadow-emerald-500/5">
                    <CheckCircle2 size={14} className="animate-in zoom-in duration-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Autorizada</span>
                </div>
            );
        }
        if (s === 'processando' || s === 'em_processamento') {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20 shadow-sm shadow-blue-500/5">
                    <RefreshCw size={14} className="animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Processando</span>
                </div>
            );
        }
        if (s === 'erro' || s === 'rejeitado') {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20 shadow-sm shadow-rose-500/5">
                    <XCircle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Rejeitada</span>
                </div>
            );
        }
        if (s === 'cancelado') {
            return (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-500/10 dark:bg-slate-500/20 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-500/20">
                    <XCircle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cancelada</span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-500/10 text-gray-500 rounded-xl border border-gray-500/20">
                <Clock3 size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{status || 'Pendente'}</span>
            </div>
        );
    };

    if (currentEntity.type === 'personal') {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-3xl opacity-10 animate-pulse"></div>
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-800 relative z-10">
                        <Receipt size={64} className="text-blue-500" />
                    </div>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Módulo Fiscal</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed mb-8">
                    A emissão de notas fiscais é exclusiva para empresas. 
                    Selecione uma empresa no topo para continuar.
                </p>
                <div className="flex items-center gap-2 px-6 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl text-xs font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-800/30">
                    <Building2 size={16} /> Seleção Necessária
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 max-w-full overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Receipt size={24} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Notas Fiscais
                            </h1>
                            <span className="text-[9px] font-black text-blue-500/50 uppercase tracking-[0.2em] mt-0.5">
                                v1.2.2 • Estável
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 ml-11">
                        Histórico de NF-e e NFS-e emitidas pela sua empresa
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Button 
                        variant="ghost" 
                        onClick={refresh} 
                        className="flex-1 md:flex-none h-11 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold text-xs"
                    >
                        <RefreshCw size={16} className={clsx("mr-2", isLoading && "animate-spin")} />
                        Atualizar Lista
                    </Button>
                    <Button 
                        variant="ghost" 
                        onClick={() => setShowConsultaModal(true)} 
                        className="flex-1 md:flex-none h-11 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold text-xs hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                        <Search size={16} className="mr-2" />
                        Consultar Notas
                    </Button>
                    <Button 
                        variant="ghost" 
                        onClick={() => setShowBillingModal(true)} 
                        className="flex-1 md:flex-none h-11 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 font-bold text-xs hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                        <BarChart3 size={16} className="mr-2 text-blue-500" />
                        Relatório de Cobrança
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={() => setShowNewModal(true)} 
                        className="flex-1 md:flex-none h-11 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 font-bold text-xs"
                    >
                        <Plus size={18} className="mr-2" />
                        Nova Nota Avulsa
                    </Button>
                </div>
            </div>

            {/* Stats */}
            {!isLoading && invoices.length > 0 && (() => {
                const invoicesForStats = invoices.filter(i => !i.deleted || showDeleted);
                return (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        {/* Autorizadas */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-emerald-100/70 dark:border-emerald-950/30 shadow-sm hover:shadow-emerald-500/5 hover:border-emerald-200 dark:hover:border-emerald-800/40 hover:scale-[1.02] transition-all duration-300 flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl ring-4 ring-emerald-50/50 dark:ring-emerald-950/10">
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Autorizadas</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {invoicesForStats.filter(i => ['concluido', 'autorizado'].includes(i.status?.toLowerCase())).length}
                                </p>
                            </div>
                        </div>
                        {/* Processando */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-blue-100/70 dark:border-blue-950/30 shadow-sm hover:shadow-blue-500/5 hover:border-blue-200 dark:hover:border-blue-800/40 hover:scale-[1.02] transition-all duration-300 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl ring-4 ring-blue-50/50 dark:ring-blue-950/10">
                                <Clock3 size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Processando</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {invoicesForStats.filter(i => ['processando', 'em_processamento'].includes(i.status?.toLowerCase())).length}
                                </p>
                            </div>
                        </div>
                        {/* Canceladas */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100/70 dark:border-slate-950/30 shadow-sm hover:shadow-slate-500/5 hover:border-slate-200 dark:hover:border-slate-800/40 hover:scale-[1.02] transition-all duration-300 flex items-center gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-950/30 text-slate-500 dark:text-slate-400 rounded-2xl ring-4 ring-slate-50/50 dark:ring-slate-950/10">
                                <XCircle size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Canceladas</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {invoicesForStats.filter(i => i.status?.toLowerCase() === 'cancelado').length}
                                </p>
                            </div>
                        </div>
                        {/* Rejeitadas */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-rose-100/70 dark:border-rose-950/30 shadow-sm hover:shadow-rose-500/5 hover:border-rose-200 dark:hover:border-rose-800/40 hover:scale-[1.02] transition-all duration-300 flex items-center gap-4">
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-2xl ring-4 ring-rose-50/50 dark:ring-rose-950/10">
                                <XCircle size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rejeitadas</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">
                                    {invoicesForStats.filter(i => ['erro', 'rejeitado'].includes(i.status?.toLowerCase())).length}
                                </p>
                            </div>
                        </div>
                        {/* Total Geral */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-indigo-100/70 dark:border-indigo-950/30 shadow-sm hover:shadow-indigo-500/5 hover:border-indigo-200 dark:hover:border-indigo-800/40 hover:scale-[1.02] transition-all duration-300 flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl ring-4 ring-indigo-50/50 dark:ring-indigo-950/10">
                                <Receipt size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Geral</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{invoicesForStats.length}</p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Search and List Header */}
            <div className="flex flex-row items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm w-full">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar nota por cliente, número ou status..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-gray-50/50 focus:bg-white dark:bg-slate-800/40 dark:focus:bg-slate-900 border border-gray-200/50 dark:border-slate-800/60 rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-400"
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setShowDeleted(!showDeleted)}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer select-none shrink-0",
                        showDeleted 
                            ? "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400 shadow-sm" 
                            : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:bg-slate-800/40 dark:border-slate-800 dark:text-gray-400 dark:hover:bg-slate-800"
                    )}
                >
                    <Trash2 size={14} className={clsx(showDeleted ? "animate-pulse text-rose-500" : "text-gray-400")} />
                    <span className="hidden sm:inline">{showDeleted ? "Exibindo Excluídas" : "Ocultando Excluídas"}</span>
                </button>
                <div className={clsx(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-colors shrink-0",
                    searchQuery 
                        ? "bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400"
                        : "bg-gray-50 border-gray-100 text-gray-500 dark:bg-slate-800/40 dark:border-slate-800 dark:text-gray-400"
                )}>
                    <Receipt size={14} />
                    <span className="hidden md:inline uppercase tracking-wider">
                        {filteredInvoices.length} {filteredInvoices.length === 1 ? 'Nota' : 'Notas'}
                    </span>
                    <span className="md:hidden">
                        {filteredInvoices.length}
                    </span>
                </div>
            </div>

            {/* List */}
            <div className="w-full max-w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="w-full overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[1100px] text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Data e Hora</th>
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Tipo</th>
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Cliente / Beneficiário</th>
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Identificação</th>
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Valor / Descrição</th>
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Status da Emissão</th>
                                <th className="py-5 px-6 text-right font-bold text-[10px] uppercase tracking-widest text-gray-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="relative mb-4">
                                                <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                                <RefreshCw size={40} className="animate-spin text-blue-500 relative z-10" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Sincronizando notas fiscais...</p>
                                            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Aguarde um instante</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-[2rem] mb-4">
                                                <Receipt size={40} className="text-gray-300 dark:text-slate-600" />
                                            </div>
                                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Nenhuma nota fiscal encontrada</p>
                                            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">Sua lista de emissões está vazia</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((invoice) => (
                                    <tr key={invoice.id} className={clsx(
                                        "group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all duration-300",
                                        invoice.deleted && "opacity-60 bg-rose-50/10 dark:bg-rose-950/5"
                                    )}>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-gray-900 dark:text-white">
                                                {new Date(invoice.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-medium">
                                                {new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="py-3 px-6">
                                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold rounded-lg border border-gray-200 dark:border-slate-700">
                                                {invoice.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-6">
                                            {invoice.quote ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                                        {invoice.quote.contact?.name || 'Cliente'}
                                                    </span>
                                                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-0.5">
                                                        <FileText size={10} />
                                                        ORÇAMENTO #{invoice.quote.quote_number || invoice.quote_id?.slice(0, 8)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                                        {invoice.payload?.tomador?.razaoSocial || invoice.payload?.destinatario?.nome || invoice.payload?.borrower?.name || invoice.payload?.retorno?.borrower?.name || 'Avulsa'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase tracking-wider">
                                                        Emissão Direta
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="flex flex-col items-start">
                                                {(() => {
                                                    const p = invoice.payload;
                                                    
                                                    // Prioriza as novas colunas físicas do banco, fazendo fallback pro payload antigo
                                                    const num = invoice.invoice_number || p?.retorno?.numeroNfse || p?.numeroNfse || p?.numeroNfe || p?.retorno?.numero || p?.numero || p?.retorno?.dps?.numero;
                                                    const chaveAcesso = invoice.access_key || p?.retorno?.chaveAcesso || p?.chaveAcesso || '';
                                                    const dpsNumero = invoice.dps_number || p?.retorno?.dps?.numero || p?.dps?.numero || p?.nacional?.dps?.numero || p?.DPS?.infDPS?.nDPS || p?.nDPS || p?.retorno?.rps?.numero || p?.rps?.numero;
                                                    const dpsSerie = invoice.dps_serie || p?.retorno?.dps?.serie || p?.dps?.serie || p?.nacional?.dps?.serie || p?.DPS?.infDPS?.serie || p?.serie || p?.retorno?.rps?.serie || p?.rps?.serie;
                                                    
                                                    const idIntegracao = invoice.payload?.idIntegracao || invoice.external_id || '';
                                                    
                                                    if (num) {
                                                        return (
                                                            <>
                                                                <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                                                    Nº {num}
                                                                </span>
                                                                {chaveAcesso && (
                                                                    <span className="text-[9px] text-emerald-600 font-mono mt-0.5 break-all leading-tight">
                                                                        {chaveAcesso}
                                                                    </span>
                                                                )}
                                                                {(dpsNumero || dpsSerie) && (
                                                                    <span className="text-[10px] text-gray-500 font-medium mt-1">
                                                                        {dpsNumero ? `DPS: ${dpsNumero}` : ''}
                                                                        {dpsNumero && dpsSerie ? ' - ' : ''}
                                                                        {dpsSerie ? `Série: ${dpsSerie}` : ''}
                                                                    </span>
                                                                )}
                                                                {idIntegracao && (
                                                                    <span className="text-[10px] text-gray-400 font-medium mt-0.5 font-mono break-all">
                                                                        ID: {idIntegracao}
                                                                    </span>
                                                                )}
                                                            </>
                                                        );
                                                    }
                                                    
                                                    return (
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-900 dark:text-gray-100 text-sm break-all leading-tight">
                                                                {idIntegracao}
                                                            </span>
                                                            {chaveAcesso && (
                                                                <span className="text-[9px] text-emerald-600 font-mono mt-1 break-all leading-tight">
                                                                    Chave: {chaveAcesso}
                                                                </span>
                                                            )}
                                                            {(dpsNumero || dpsSerie) && (
                                                                <span className="text-[10px] text-gray-500 font-medium mt-1">
                                                                    {dpsNumero ? `DPS: ${dpsNumero}` : ''}
                                                                    {dpsNumero && dpsSerie ? ' - ' : ''}
                                                                    {dpsSerie ? `Série: ${dpsSerie}` : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                                    {(() => {
                                                        const p = invoice.payload;
                                                        if (!p) return 'R$ 0,00';
                                                        
                                                        // Tenta extrair de servico (pode ser array no Nacional ou objeto no Municipal)
                                                        const servicos = Array.isArray(p?.servico) ? p.servico : (p?.servico ? [p.servico] : []);
                                                        const servico = servicos[0];
                                                        
                                                        // Tenta várias fontes de valor
                                                        const val = p?.servicesAmount || 
                                                                   p?.retorno?.servicesAmount || 
                                                                   p?.retorno?.valorTotal || 
                                                                   servico?.valor?.servico || 
                                                                   p?.valorTotal || 
                                                                   p?.valorTotalBruto || 
                                                                   0;
                                                        
                                                        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
                                                    })()}
                                                </span>
                                                <Tooltip content={(() => {
                                                    const p = invoice.payload;
                                                    const servicos = Array.isArray(p?.servico) ? p.servico : (p?.servico ? [p.servico] : []);
                                                    const servico = servicos[0];
                                                    return servico?.discriminacao || p?.itens?.[0]?.descricao || 'Sem descrição';
                                                })()}>
                                                    <span className="text-[10px] text-blue-500 font-medium mt-0.5 cursor-help flex items-center gap-1 hover:underline">
                                                        <Search size={10} />
                                                        Ver Descrição
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                {getStatusBadge(invoice.status)}
                                                {invoice.deleted && (
                                                    <div className="px-2.5 py-1 bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-rose-500/20">
                                                        Excluída do Histórico
                                                    </div>
                                                )}
                                                {invoice.status?.toLowerCase() === 'cancelado' && (
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] font-bold rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <AlertCircle size={10} />
                                                        {invoice.payload?.cancelamento?.justificativa || 'Cancelamento solicitado'}
                                                    </div>
                                                )}
                                                {invoice.error_message && (
                                                    <Tooltip content={invoice.error_message}>
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] font-bold rounded-lg border border-rose-500/20 animate-pulse cursor-help">
                                                            <AlertCircle size={10} />
                                                            VER MOTIVO DA REJEIÇÃO
                                                        </div>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-6 text-right">
                                            <div className="flex justify-end items-center gap-1.5">
                                                {/* Duplicar / Editar */}
                                                <Tooltip content="Duplicar / Corrigir">
                                                    <button
                                                        onClick={() => handleDuplicateInvoice(invoice)}
                                                        className="h-10 w-10 flex items-center justify-center glass-morphism text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm"
                                                    >
                                                        <Copy size={18} />
                                                    </button>
                                                </Tooltip>

                                                {invoice.external_id && (['processando', 'em_processamento'].includes(invoice.status?.toLowerCase()) || !(invoice.invoice_number || invoice.payload?.retorno?.numeroNfse || invoice.payload?.numeroNfse || invoice.payload?.numeroNfe || invoice.payload?.retorno?.numero || invoice.payload?.numero || invoice.payload?.retorno?.dps?.numero)) && (
                                                    <Tooltip content="Sincronizar Status">
                                                        <button
                                                            onClick={() => handleRefreshStatus(invoice)}
                                                            disabled={isRefreshing === invoice.id}
                                                            className="h-10 w-10 flex items-center justify-center glass-morphism text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all shadow-sm"
                                                        >
                                                            <RefreshCw size={18} className={isRefreshing === invoice.id ? 'animate-spin' : ''} />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                                {invoice.external_id && (
                                                    <Tooltip content="Visualizar Nota (PDF/XML)">
                                                        <button
                                                            onClick={() => handleViewInternal(invoice)}
                                                            disabled={isRefreshing === invoice.id}
                                                            className="h-10 w-10 flex items-center justify-center glass-morphism text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all shadow-sm"
                                                        >
                                                            {isRefreshing === invoice.id ? (
                                                                <RefreshCw size={18} className="animate-spin" />
                                                            ) : (
                                                                <Eye size={18} />
                                                            )}
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {invoice.external_id && invoice.pdf_url && ['concluido', 'autorizado', 'cancelado'].includes(invoice.status?.toLowerCase()) && (
                                                    <Tooltip content="Ver Link Externo">
                                                        <button
                                                            onClick={() => window.open(invoice.pdf_url, '_blank')}
                                                            className="h-10 w-10 flex items-center justify-center glass-morphism text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm"
                                                        >
                                                            <ExternalLink size={18} />
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {invoice.external_id && ['concluido', 'autorizado'].includes(invoice.status?.toLowerCase()) && (
                                                    <Tooltip content="Cancelar na Prefeitura">
                                                        <button
                                                            onClick={() => {
                                                                setCancelModal({ isOpen: true, invoice });
                                                                setCancelReason('');
                                                            }}
                                                            className="h-10 w-10 flex items-center justify-center glass-morphism text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all shadow-sm"
                                                        >
                                                            <XCircle size={18} />
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {invoice.external_id && ['concluido', 'autorizado', 'cancelado'].includes(invoice.status?.toLowerCase()) && (
                                                    <Tooltip content="Baixar PDF">
                                                        <button
                                                            onClick={() => handleDownloadPDF(invoice)}
                                                            className="h-10 w-10 flex items-center justify-center glass-morphism text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all shadow-sm"
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {invoice.external_id && ['concluido', 'autorizado', 'cancelado'].includes(invoice.status?.toLowerCase()) && (
                                                    <Tooltip content="Baixar XML">
                                                        <button
                                                            onClick={() => handleDownloadXML(invoice)}
                                                            className="h-10 w-10 flex items-center justify-center glass-morphism text-orange-600 dark:text-orange-400 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-all shadow-sm"
                                                        >
                                                            <FileCode size={18} />
                                                        </button>
                                                    </Tooltip>
                                                )}

                                                {invoice.external_id && ['concluido', 'autorizado'].includes(invoice.status?.toLowerCase()) && (
                                                    <>
                                                        {config?.send_whatsapp_automatically && (
                                                            <Tooltip content="Enviar por WhatsApp">
                                                                <button
                                                                    onClick={() => handleOpenSendWhatsApp(invoice)}
                                                                    className="h-10 w-10 flex items-center justify-center glass-morphism text-teal-600 dark:text-teal-400 rounded-xl hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-all shadow-sm"
                                                                >
                                                                    <MessageCircle size={18} />
                                                                </button>
                                                            </Tooltip>
                                                        )}

                                                        {config?.send_email_automatically && (
                                                            <Tooltip content="Enviar por E-mail">
                                                                <button
                                                                    onClick={() => handleOpenSendEmail(invoice)}
                                                                    className="h-10 w-10 flex items-center justify-center glass-morphism text-sky-600 dark:text-sky-400 rounded-xl hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all shadow-sm"
                                                                >
                                                                    <Mail size={18} />
                                                                </button>
                                                            </Tooltip>
                                                        )}
                                                    </>
                                                )}

                                                {/* Excluir do Histórico apenas se estiver cancelada ou com erro e ainda não excluída */}
                                                {(['cancelado', 'erro', 'rejeitado'].includes(invoice.status?.toLowerCase())) && !invoice.deleted && (
                                                    <Tooltip content="Excluir do Histórico">
                                                        <button
                                                            onClick={() => setDeleteModal({ isOpen: true, invoiceId: invoice.id })}
                                                            className="h-10 w-10 flex items-center justify-center glass-morphism text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all shadow-sm"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showNewModal && (
                <StandaloneInvoiceModal 
                    onClose={() => {
                        setShowNewModal(false);
                        setDuplicateData(null);
                    }} 
                    onSuccess={() => {
                        setShowNewModal(false);
                        setDuplicateData(null);
                        refresh();
                    }} 
                    initialData={duplicateData}
                    initialType={duplicateData?.type}
                    initialNotes={duplicateData?.notes}
                />
            )}

            {showConsultaModal && (
                <ConsultaNotasModal 
                    onClose={() => setShowConsultaModal(false)} 
                    companyId={currentEntity.id!}
                />
            )}

            {showBillingModal && (
                <BillingReportModal 
                    isOpen={showBillingModal}
                    onClose={() => setShowBillingModal(false)}
                    invoices={invoices}
                />
            )}



            {/* Modal de Exclusão */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl">
                                <Trash2 size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ocultar do Histórico</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">A nota será arquivada no histórico.</p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                            Tem certeza que deseja ocultar esta nota fiscal do seu painel principal?
                            Por motivos fiscais, de faturamento e auditoria, o registro não será deletado do banco de dados, mas ficará oculto. Você poderá consultá-lo ativando a opção "Mostrar Excluídas do Histórico".
                        </p>

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => setDeleteModal({ isOpen: false, invoiceId: null })}
                                className="flex-1 h-12 rounded-xl font-bold text-gray-500"
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleDeleteInvoice}
                                isLoading={isDeleting}
                                className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-500/20 rounded-xl font-bold"
                            >
                                Sim, Remover
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Envio Manual (WhatsApp / E-mail) */}
            {sendModal.isOpen && (
                <Modal
                    isOpen={sendModal.isOpen}
                    onClose={() => setSendModal(prev => ({ ...prev, isOpen: false }))}
                    title={sendModal.type === 'whatsapp' ? 'Enviar via WhatsApp' : 'Enviar via E-mail'}
                    subtitle={sendModal.type === 'whatsapp' ? 'Disparo de mensagem com o link do PDF' : 'Envio automático do PDF e XML por e-mail'}
                    icon={sendModal.type === 'whatsapp' ? MessageCircle : Mail}
                    variant={sendModal.type === 'whatsapp' ? 'success' : 'info'}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-6 pt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                {sendModal.type === 'whatsapp' ? 'Número do WhatsApp (com DDD)' : 'Endereço de E-mail'}
                            </label>
                            <input
                                type="text"
                                value={sendModal.recipient}
                                onChange={(e) => setSendModal(prev => ({ ...prev, recipient: e.target.value }))}
                                placeholder={sendModal.type === 'whatsapp' ? 'Ex: 44999999999' : 'Ex: cliente@email.com'}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold"
                            />
                        </div>

                        {sendModal.type === 'whatsapp' && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                    Mensagem
                                </label>
                                <textarea
                                    value={sendModal.message}
                                    onChange={(e) => setSendModal(prev => ({ ...prev, message: e.target.value }))}
                                    rows={4}
                                    className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold text-sm resize-none"
                                />
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="ghost"
                                onClick={() => setSendModal(prev => ({ ...prev, isOpen: false }))}
                                className="flex-1 h-12 rounded-xl font-bold text-gray-500"
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSendDocument}
                                isLoading={sendModal.isLoading}
                                className={clsx(
                                    "flex-1 h-12 shadow-lg rounded-xl font-bold text-white",
                                    sendModal.type === 'whatsapp' 
                                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" 
                                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                                )}
                            >
                                Confirmar Envio
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal de Cancelamento */}
            {cancelModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl">
                                <AlertTriangle size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cancelar Nota Fiscal</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Esta ação não pode ser desfeita.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5">Justificativa (Mínimo 15 caracteres)</label>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Ex: Nota emitida com valor incorreto ou serviço cancelado pelo cliente..."
                                    className="w-full h-32 p-4 rounded-2xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 text-sm focus:border-blue-500 outline-none transition-all resize-none"
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setCancelModal({ isOpen: false, invoice: null });
                                        setCancelReason('');
                                    }}
                                    className="flex-1 h-12 rounded-xl font-bold text-gray-500"
                                >
                                    Voltar
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleCancelInvoice}
                                    disabled={cancelReason.length < 15 || isCancelling}
                                    isLoading={isCancelling}
                                    className="flex-1 h-12 bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-500/20 rounded-xl font-bold"
                                >
                                    Confirmar Cancelamento
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {cancelModal.invoice && isProtectedModalOpen && (
                <DeleteProtectionModal
                    isOpen={isProtectedModalOpen}
                    onClose={(isSuccess) => {
                        setIsProtectedModalOpen(false);
                        if (!isSuccess) {
                            setCancelModal(prev => ({ ...prev, isOpen: true }));
                        }
                    }}
                    onConfirm={executeCancelInvoice}
                    transaction={(() => {
                        const inv = cancelModal.invoice;
                        const p = inv.payload;
                        const servicos = p ? (Array.isArray(p.servico) ? p.servico : (p.servico ? [p.servico] : [])) : [];
                        const val = p?.servicesAmount || 
                                                                    p?.retorno?.servicesAmount || 
                                                                    p?.retorno?.valorTotal || 
                                                                    servicos[0]?.valor?.servico || 
                                                                    p?.valorTotal || 
                                                                    p?.valorTotalBruto || 
                                                                    0;
                        return {
                            description: `Cancelamento de Nota Fiscal ${inv.external_id ? `(${inv.external_id.slice(-6)})` : ''}`,
                            amount: val,
                            company_id: inv.company_id,
                            date: inv.created_at?.split('T')[0]
                        };
                    })()}
                    invoiceNumber={(() => {
                        const inv = cancelModal.invoice;
                        const p = inv.payload;
                        return inv.invoice_number || p?.retorno?.numeroNfse || p?.numeroNfse || p?.numeroNfe || p?.retorno?.numero || p?.numero || p?.retorno?.dps?.numero || 'Emitida';
                    })()}
                />
            )}

            {selectedInvoiceDetail && (
                <InvoiceDetailModal
                    isOpen={!!selectedInvoiceDetail}
                    onClose={() => setSelectedInvoiceDetail(null)}
                    invoice={selectedInvoiceDetail}
                    onRefresh={refresh}
                    company={companies.find(c => c.id === selectedInvoiceDetail.company_id) || currentCompany}
                />
            )}

            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
                data={resultModal.data}
            />
        </div>
    );
}
