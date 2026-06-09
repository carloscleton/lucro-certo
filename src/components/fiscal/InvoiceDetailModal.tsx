import { useState, useEffect } from 'react';
import { 
    X, Receipt, DollarSign, User, MapPin, Mail, MessageCircle, FileText, 
    FileCode, Trash2, AlertTriangle, Printer, History, 
    UserCheck, XCircle, CheckCircle2, Clock3, RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fiscalService } from '../../services/fiscalService';
import { whatsappService } from '../../services/whatsappService';
import { Button } from '../ui/Button';
import { DeleteProtectionModal } from '../transactions/DeleteProtectionModal';
import { API_BASE_URL } from '../../lib/constants';

interface InvoiceDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
    onRefresh: () => void;
}

export function InvoiceDetailModal({ isOpen, onClose, invoice, onRefresh }: InvoiceDetailModalProps) {
    const [events, setEvents] = useState<any[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isProtectedModalOpen, setIsProtectedModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const [sendModal, setSendModal] = useState<{
        isOpen: boolean;
        type: 'whatsapp' | 'email';
        recipient: string;
        message: string;
        isLoading: boolean;
    }>({
        isOpen: false,
        type: 'whatsapp',
        recipient: '',
        message: '',
        isLoading: false
    });

    const [waInstances, setWaInstances] = useState<any[]>([]);

    useEffect(() => {
        if (!isOpen || !invoice?.company_id) return;
        const fetchWA = async () => {
            const { data } = await supabase
                .from('instances')
                .select('*')
                .eq('status', 'connected')
                .eq('company_id', invoice.company_id);
            setWaInstances(data || []);
        };
        fetchWA();
    }, [invoice?.company_id, isOpen]);

    // Buscar linha do tempo de eventos
    const fetchEvents = async () => {
        if (!invoice?.id) return;
        setLoadingEvents(true);
        try {
            const { data, error } = await supabase
                .from('fiscal_invoice_events')
                .select(`
                    id,
                    event_type,
                    description,
                    metadata,
                    created_at,
                    user:user_id (
                        full_name,
                        email
                    )
                `)
                .eq('invoice_id', invoice.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            
            const normalized = (data || []).map((ev: any) => {
                const u = Array.isArray(ev.user) ? ev.user[0] : ev.user;
                return {
                    ...ev,
                    userName: u?.full_name || u?.email || 'Sistema (Automático)'
                };
            });
            
            setEvents(normalized);
        } catch (err) {
            console.error('Erro ao buscar eventos de auditoria:', err);
        } finally {
            setLoadingEvents(false);
        }
    };

    useEffect(() => {
        if (isOpen && invoice?.id) {
            fetchEvents();
        }
    }, [invoice?.id, isOpen]);

    if (!isOpen || !invoice) return null;

    const payload = invoice.payload || {};
    const retorno = payload.retorno || {};

    // Extrair dados do cliente/tomador
    const clientName = invoice.quote?.contact?.name || 
                       payload.tomador?.razaoSocial || 
                       payload.destinatario?.razaoSocial || 
                       payload.destinatario?.nome || 
                       retorno.tomador?.razaoSocial ||
                       'Cliente Desconhecido';
                       
    const clientTaxId = invoice.quote?.contact?.tax_id || 
                        payload.tomador?.cpfCnpj || 
                        payload.destinatario?.cpfCnpj || 
                        payload.destinatario?.cnpj || 
                        '';

    const clientEmail = invoice.quote?.contact?.email || 
                         payload.tomador?.email || 
                         payload.destinatario?.email || 
                         '';

    // Extrair dados do endereço
    const addr = payload.tomador?.endereco || payload.destinatario?.endereco || {};
    const clientAddress = addr.logradouro 
        ? `${addr.logradouro}, ${addr.numero || 'S/N'}${addr.complemento ? ' - ' + addr.complemento : ''} - ${addr.bairro || ''}, ${addr.descricaoCidade || addr.cidade || ''}/${addr.estado || addr.uf || ''} (CEP: ${addr.cep || ''})`
        : '';

    // Extrair valores
    const totalAmount = invoice.amount || 
                        payload.servico?.[0]?.valor?.servico || 
                        payload.itens?.[0]?.valorUnitario?.comercial || 
                        0;

    const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount);

    const description = payload.servico?.[0]?.discriminacao || 
                        payload.itens?.[0]?.descricao || 
                        'Prestação de serviço avulsa';

    // Resolver Links de Documentos
    const getDocUrl = (format: 'pdf' | 'xml'): string => {
        if (format === 'pdf' && invoice.pdf_url && invoice.pdf_url.startsWith('http')) {
            return invoice.pdf_url;
        }
        if (format === 'xml' && invoice.xml_url && invoice.xml_url.startsWith('http')) {
            return invoice.xml_url;
        }
        
        let apiBase = API_BASE_URL.replace(/\/$/, '');
        if (apiBase.startsWith('/')) {
            apiBase = window.location.origin + apiBase;
        }
        return `${apiBase}/fiscal-module/${invoice.type}/${invoice.external_id}/${format}?companyId=${invoice.company_id}`;
    };

    const pdfUrl = getDocUrl('pdf');

    // Baixar arquivos
    const handleDownloadFile = async (format: 'pdf' | 'xml') => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            
            const blob = format === 'pdf' 
                ? await fiscalService.downloadPDF(invoice.external_id, invoice.type, invoice.company_id, token)
                : await fiscalService.downloadXML(invoice.external_id, invoice.type, invoice.company_id, token);
                
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nota_${invoice.invoice_number || invoice.external_id}.${format}`;
            a.click();
        } catch (error) {
            console.error(`Erro ao baixar ${format.toUpperCase()}:`, error);
            alert(`Erro ao fazer o download do ${format.toUpperCase()} da nota fiscal.`);
        }
    };

    // Atualizar Status da Nota
    const handleRefreshStatus = async () => {
        setIsRefreshing(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            await fiscalService.checkStatus(invoice.external_id, invoice.company_id, token);
            await fetchEvents();
            onRefresh();
        } catch (error: any) {
            console.error('Erro ao atualizar status:', error);
            alert('Falha ao atualizar o status da nota na TecnoSpeed: ' + error.message);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Executar cancelamento real no banco e Tecnospeed
    const executeCancelInvoice = async () => {
        setIsCancelling(true);
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');

            await fiscalService.cancelarNota(
                invoice.external_id,
                invoice.type,
                invoice.company_id,
                cancelReason,
                token
            );

            setShowCancelModal(false);
            setCancelReason('');
            await fetchEvents();
            onRefresh();
            alert('Cancelamento solicitado com sucesso!');
        } catch (error: any) {
            console.error('Erro ao cancelar nota:', error);
            alert('Erro no cancelamento: ' + (error.response?.data?.error?.message || error.message));
        } finally {
            setIsCancelling(false);
        }
    };

    // Validar regras para cancelamento
    const handleCancelInvoice = async () => {
        if (!cancelReason.trim()) return;
        const isAuthorized = ['concluido', 'autorizado'].includes(invoice.status?.toLowerCase());

        // Se a nota estiver concluída/autorizada, exige validação do administrador via WhatsApp
        if (isAuthorized) {
            setIsProtectedModalOpen(true);
            return;
        }

        await executeCancelInvoice();
    };

    // Excluir registro do histórico local
    const handleDeleteInvoice = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('fiscal_invoices').delete().eq('id', invoice.id);
            if (error) throw error;
            
            setShowDeleteConfirm(false);
            onClose();
            onRefresh();
        } catch (error: any) {
            alert('Erro ao excluir do banco de dados: ' + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    // Compartilhar Documento (WhatsApp / E-mail)
    const handleOpenSend = (mediaType: 'whatsapp' | 'email') => {
        const phone = invoice.quote?.contact?.whatsapp || invoice.quote?.contact?.phone || payload.tomador?.telefone || '';
        const cleanPhone = String(phone).replace(/\D/g, '');
        
        setSendModal({
            isOpen: true,
            type: mediaType,
            recipient: mediaType === 'whatsapp' ? cleanPhone : clientEmail,
            message: `Olá, *${clientName}*! 👋\n\nSua Nota Fiscal foi emitida com sucesso.\nClique no link abaixo para visualizar e baixar o documento:\n\n${pdfUrl}`,
            isLoading: false
        });
    };

    const handleSendDocument = async () => {
        if (!sendModal.recipient) {
            alert('Por favor, preencha o campo do destinatário.');
            return;
        }

        setSendModal(prev => ({ ...prev, isLoading: true }));
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada. Faça login novamente.');

            if (sendModal.type === 'whatsapp') {
                const instance = waInstances[0];
                if (!instance) {
                    throw new Error('Nenhuma instância de WhatsApp conectada e ativa encontrada para sua empresa.');
                }

                await whatsappService.sendMessage({
                    instanceName: instance.instance_name || instance.name,
                    number: sendModal.recipient,
                    text: sendModal.message,
                    mediaUrl: pdfUrl.startsWith('http') ? pdfUrl : undefined,
                    mediaType: 'document',
                    mimetype: 'application/pdf',
                    fileName: `NotaFiscal-${invoice.invoice_number || invoice.external_id || 'avulsa'}.pdf`
                });
            } else {
                await fiscalService.resendEmail(
                    invoice.external_id,
                    invoice.type,
                    invoice.company_id,
                    [sendModal.recipient],
                    token
                );
            }
            
            alert('Documento enviado com sucesso!');
            setSendModal(prev => ({ ...prev, isOpen: false }));
        } catch (err: any) {
            console.error('Erro ao enviar documento:', err);
            alert(err.message || 'Ocorreu um erro ao tentar enviar o documento.');
        } finally {
            setSendModal(prev => ({ ...prev, isLoading: false }));
        }
    };

    // Estilos do Badge de Status
    const getStatusStyle = (status: string) => {
        const s = status?.toLowerCase();
        if (s === 'concluido' || s === 'autorizado') {
            return {
                bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                icon: <CheckCircle2 size={14} />,
                label: 'Autorizada'
            };
        }
        if (s === 'processando' || s === 'em_processamento') {
            return {
                bg: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20',
                icon: <Clock3 size={14} className="animate-pulse" />,
                label: 'Processando'
            };
        }
        if (s === 'erro' || s === 'rejeitado') {
            return {
                bg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20',
                icon: <XCircle size={14} />,
                label: 'Rejeitada'
            };
        }
        if (s === 'cancelado') {
            return {
                bg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-500 dark:text-slate-400 border-slate-500/20',
                icon: <XCircle size={14} />,
                label: 'Cancelada'
            };
        }
        return {
            bg: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
            icon: <Clock3 size={14} />,
            label: status || 'Pendente'
        };
    };

    const statusStyle = getStatusStyle(invoice.status);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 w-full max-w-4xl h-[90vh] max-h-[800px] flex flex-col animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/30 p-6 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                            <Receipt size={22} />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                                Nota Fiscal {invoice.invoice_number ? `Nº ${invoice.invoice_number}` : 'Avulsa'}
                                <span className="text-xs font-black uppercase text-gray-400">({invoice.type})</span>
                            </h3>
                            <p className="text-xs text-gray-400 font-semibold truncate max-w-sm">ID PlugNotas: {invoice.external_id}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider ${statusStyle.bg}`}>
                            {statusStyle.icon}
                            {statusStyle.label}
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-slate-800">
                    
                    {/* Left: General Info & Summary */}
                    <div className="col-span-2 p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)] scrollbar-thin">
                        
                        {/* Cliente */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                <User size={12} /> Dados do Tomador / Cliente
                            </h4>
                            <div className="bg-gray-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-gray-100/70 dark:border-slate-800 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400 font-semibold">Nome / Razão Social:</span>
                                    <span className="text-gray-900 dark:text-white font-bold">{clientName}</span>
                                </div>
                                {clientTaxId && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400 font-semibold">CPF / CNPJ:</span>
                                        <span className="text-gray-900 dark:text-white font-mono font-bold">{clientTaxId}</span>
                                    </div>
                                )}
                                {clientEmail && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400 font-semibold">E-mail:</span>
                                        <span className="text-gray-900 dark:text-white font-bold">{clientEmail}</span>
                                    </div>
                                )}
                                {clientAddress && (
                                    <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-start gap-2 text-xs">
                                        <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                        <span className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{clientAddress}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Identificadores Fiscais */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                <FileCode size={12} /> Identificação do Documento
                            </h4>
                            <div className="bg-gray-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-gray-100/70 dark:border-slate-800 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400 font-semibold">Tipo de Nota:</span>
                                    <span className="text-gray-900 dark:text-white font-bold uppercase">{invoice.type}</span>
                                </div>
                                {invoice.invoice_number && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400 font-semibold">Número da Nota:</span>
                                        <span className="text-gray-900 dark:text-white font-bold">{invoice.invoice_number}</span>
                                    </div>
                                )}
                                {invoice.access_key && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400 font-semibold">Chave de Acesso / Cód. Verificação:</span>
                                        <span className="text-gray-900 dark:text-white font-mono font-bold break-all ml-4 text-right">{invoice.access_key}</span>
                                    </div>
                                )}
                                {invoice.protocol && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400 font-semibold">Protocolo de Autorização:</span>
                                        <span className="text-gray-900 dark:text-white font-mono font-bold">{invoice.protocol}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400 font-semibold">Emitida em:</span>
                                    <span className="text-gray-900 dark:text-white font-bold">
                                        {new Date(invoice.created_at).toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Descrição e Valores */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                <DollarSign size={12} /> Descrição dos Serviços & Valores
                            </h4>
                            <div className="bg-gray-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-gray-100/70 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400 font-semibold">Valor Total Líquido:</span>
                                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formattedAmount}</span>
                                </div>
                                <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1 text-xs">
                                    <span className="text-gray-400 font-semibold uppercase tracking-widest text-[9px]">Discriminação / Itens:</span>
                                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800 max-h-24 overflow-y-auto scrollbar-thin">
                                        {description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Erros / Motivos se houver */}
                        {invoice.error_message && (
                            <div className="bg-rose-50 dark:bg-rose-950/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-400 text-xs">
                                <p className="font-bold flex items-center gap-1.5">
                                    <AlertTriangle size={14} /> Rejeição da Prefeitura
                                </p>
                                <p className="mt-1 leading-relaxed font-medium">{invoice.error_message}</p>
                            </div>
                        )}

                        {/* Motivo de Cancelamento se houver */}
                        {invoice.cancellation_reason && (
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-300 text-xs">
                                <p className="font-bold flex items-center gap-1.5 text-gray-900 dark:text-white">
                                    <AlertTriangle size={14} /> Motivo do Cancelamento
                                </p>
                                <p className="mt-1 leading-relaxed font-medium">{invoice.cancellation_reason}</p>
                            </div>
                        )}
                    </div>

                    {/* Right: Actions & Timeline */}
                    <div className="p-6 space-y-6 flex flex-col max-h-[calc(90vh-140px)] overflow-y-auto scrollbar-thin bg-gray-50/30 dark:bg-slate-800/10">
                        
                        {/* Ações */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                <Printer size={12} /> Ações Rápidas
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    onClick={() => handleDownloadFile('pdf')}
                                    disabled={!['concluido', 'autorizado', 'cancelado'].includes(invoice.status?.toLowerCase())}
                                    variant="outline"
                                    className="h-10 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <FileText size={14} />
                                    Baixar PDF
                                </Button>
                                <Button 
                                    onClick={() => handleDownloadFile('xml')}
                                    disabled={!['concluido', 'autorizado', 'cancelado'].includes(invoice.status?.toLowerCase())}
                                    variant="outline"
                                    className="h-10 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <FileCode size={14} />
                                    Baixar XML
                                </Button>
                                <Button 
                                    onClick={() => handleOpenSend('whatsapp')}
                                    disabled={!['concluido', 'autorizado'].includes(invoice.status?.toLowerCase())}
                                    variant="outline"
                                    className="h-10 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <MessageCircle size={14} />
                                    WhatsApp
                                </Button>
                                <Button 
                                    onClick={() => handleOpenSend('email')}
                                    disabled={!['concluido', 'autorizado'].includes(invoice.status?.toLowerCase())}
                                    variant="outline"
                                    className="h-10 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <Mail size={14} />
                                    Enviar E-mail
                                </Button>
                                
                                <Button 
                                    onClick={handleRefreshStatus}
                                    isLoading={isRefreshing}
                                    variant="ghost"
                                    className="col-span-2 h-10 text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl"
                                >
                                    <RefreshCw size={14} className={isRefreshing ? "animate-spin mr-1.5" : "mr-1.5"} />
                                    Atualizar Status
                                </Button>

                                {['concluido', 'autorizado', 'processando', 'em_processamento'].includes(invoice.status?.toLowerCase()) && (
                                    <Button 
                                        onClick={() => setShowCancelModal(true)}
                                        variant="ghost"
                                        className="col-span-2 h-10 text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl"
                                    >
                                        <Trash2 size={14} className="mr-1.5" />
                                        Solicitar Cancelamento
                                    </Button>
                                )}

                                {!['concluido', 'autorizado', 'cancelado'].includes(invoice.status?.toLowerCase()) && (
                                    <Button 
                                        onClick={() => setShowDeleteConfirm(true)}
                                        variant="ghost"
                                        className="col-span-2 h-10 text-xs font-bold bg-slate-500/10 hover:bg-slate-500/20 text-slate-600 dark:text-slate-400 rounded-xl border border-dashed border-slate-500/20"
                                    >
                                        <Trash2 size={14} className="mr-1.5" />
                                        Excluir Registro Local
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Linha do Tempo (Timeline) */}
                        <div className="flex-1 space-y-3 flex flex-col">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                <History size={12} /> Histórico & Auditoria
                            </h4>
                            
                            <div className="flex-1 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-y-auto max-h-[300px] scrollbar-thin">
                                {loadingEvents ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-blue-500 gap-2">
                                        <RefreshCw size={24} className="animate-spin" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Carregando Auditoria...</span>
                                    </div>
                                ) : events.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-12 font-medium">Nenhum evento registrado para esta nota.</p>
                                ) : (
                                    <div className="relative pl-4 border-l border-gray-100 dark:border-slate-800 space-y-6">
                                        {events.map((event) => {
                                            const isDone = ['autorizada', 'cancelado'].includes(event.event_type);
                                            const isErr = ['rejeitada', 'erro'].includes(event.event_type);
                                            const isReq = ['emissao_solicitada', 'cancelamento_solicitado'].includes(event.event_type);

                                            return (
                                                <div key={event.id} className="relative group/item">
                                                    {/* Marcador */}
                                                    <span className={`absolute -left-[23px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900 ${
                                                        isDone ? 'bg-emerald-500 text-white' : 
                                                        isErr ? 'bg-rose-500 text-white' : 
                                                        isReq ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'
                                                    }`}>
                                                        {isDone ? <CheckCircle2 size={10} /> : 
                                                         isErr ? <XCircle size={10} /> : 
                                                         isReq ? <Clock3 size={10} /> : <UserCheck size={10} />}
                                                    </span>

                                                    {/* Conteúdo */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-xs font-black text-gray-900 dark:text-white capitalize leading-tight">
                                                                {event.event_type.replace('_', ' ')}
                                                            </p>
                                                            <span className="text-[9px] text-gray-400 font-bold bg-gray-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                                                                {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal font-medium">
                                                            {event.description}
                                                        </p>
                                                        <div className="flex items-center gap-1 text-[9px] text-gray-400 font-bold">
                                                            <User size={10} />
                                                            {event.userName} • {new Date(event.created_at).toLocaleDateString()}
                                                        </div>
                                                        
                                                        {/* Justificativa de cancelamento no evento */}
                                                        {event.metadata?.cancellation_reason && (
                                                            <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-[9px] text-gray-500 dark:text-slate-400 border border-gray-100 dark:border-slate-800 font-medium">
                                                                Motivo: {event.metadata.cancellation_reason}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                </div>

            </div>

            {/* Modal para Cancelamento */}
            {showCancelModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-6 border border-gray-100 dark:border-slate-800 w-full max-w-md animate-in zoom-in-95 duration-300">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <AlertTriangle className="text-amber-500" size={20} /> Solicitar Cancelamento
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-semibold leading-relaxed">
                            O cancelamento de uma nota fiscal é irreversível. É necessário descrever uma justificativa válida para a receita federal e prefeitura de no mínimo 15 caracteres.
                        </p>
                        
                        <textarea
                            placeholder="Justificativa do cancelamento (ex: Erro de digitação no valor, serviço não prestado pelo cliente)..."
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            rows={3}
                            className="w-full p-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 mb-5"
                        />

                        <div className="flex gap-3">
                            <Button
                                onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                                variant="ghost"
                                className="flex-1 h-11 text-xs font-bold"
                            >
                                Voltar
                            </Button>
                            <Button
                                onClick={handleCancelInvoice}
                                isLoading={isCancelling}
                                disabled={cancelReason.trim().length < 15}
                                className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                            >
                                Confirmar Cancelamento
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmação de exclusão do banco local */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-6 border border-gray-100 dark:border-slate-800 w-full max-w-md animate-in zoom-in-95 duration-300">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <AlertTriangle className="text-rose-500" size={20} /> Excluir Registro Local
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 font-semibold leading-relaxed">
                            Tem certeza que deseja excluir esta nota fiscal do banco de dados local? Esta ação <strong>NÃO</strong> cancela a nota fiscal física na prefeitura, apenas limpa o histórico da plataforma.
                        </p>
                        
                        <div className="flex gap-3">
                            <Button
                                onClick={() => setShowDeleteConfirm(false)}
                                variant="ghost"
                                className="flex-1 h-11 text-xs font-bold"
                            >
                                Voltar
                            </Button>
                            <Button
                                onClick={handleDeleteInvoice}
                                isLoading={isDeleting}
                                className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                            >
                                Excluir Registro
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Autenticação do Administrador via WhatsApp */}
            <DeleteProtectionModal
                isOpen={isProtectedModalOpen}
                onClose={() => setIsProtectedModalOpen(false)}
                onConfirm={executeCancelInvoice}
                transaction={{
                    description: `Cancelamento de Nota Fiscal Nº ${invoice.invoice_number || invoice.external_id}`,
                    paid_amount: totalAmount,
                    company_id: invoice.company_id
                }}
                invoiceNumber={invoice.invoice_number || invoice.external_id}
            />

            {/* Modal para reenvio via E-mail / WhatsApp */}
            {sendModal.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-6 border border-gray-100 dark:border-slate-800 w-full max-w-md animate-in zoom-in-95 duration-300">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            {sendModal.type === 'whatsapp' ? <MessageCircle className="text-emerald-500" /> : <Mail className="text-blue-500" />}
                            Enviar Nota Fiscal
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-semibold">
                            {sendModal.type === 'whatsapp' 
                                ? 'Dispare uma mensagem contendo o PDF da nota fiscal para o cliente via WhatsApp.' 
                                : 'Reenvie o e-mail contendo os arquivos PDF e XML da nota fiscal.'}
                        </p>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    {sendModal.type === 'whatsapp' ? 'Número do WhatsApp (com DDI/DDD)' : 'E-mail do Destinatário'}
                                </label>
                                <input
                                    type="text"
                                    value={sendModal.recipient}
                                    onChange={(e) => setSendModal(prev => ({ ...prev, recipient: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {sendModal.type === 'whatsapp' && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        Mensagem a ser enviada
                                    </label>
                                    <textarea
                                        value={sendModal.message}
                                        onChange={(e) => setSendModal(prev => ({ ...prev, message: e.target.value }))}
                                        rows={4}
                                        className="w-full p-3 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={() => setSendModal(prev => ({ ...prev, isOpen: false }))}
                                    variant="ghost"
                                    className="flex-1 h-11 text-xs font-bold"
                                >
                                    Voltar
                                </Button>
                                <Button
                                    onClick={handleSendDocument}
                                    isLoading={sendModal.isLoading}
                                    className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                                >
                                    Enviar Documento
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
