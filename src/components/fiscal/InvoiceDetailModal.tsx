import { useState, useEffect, useRef } from 'react';
import { 
    X, Receipt, DollarSign, User, MapPin, FileText, 
    FileCode, Trash2, AlertTriangle, Printer, History, 
    UserCheck, XCircle, CheckCircle2, Clock3, RefreshCw,
    Maximize2, Minimize2, CreditCard, Copy, ExternalLink, QrCode, Check
} from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '../../lib/supabase';
import { fiscalService } from '../../services/fiscalService';
import { Button } from '../ui/Button';
import { DeleteProtectionModal } from '../transactions/DeleteProtectionModal';
import { API_BASE_URL } from '../../lib/constants';
import { parseFiscalError } from '../../pages/Invoices';
import { getInvoiceFilename } from '../../utils/invoiceUtils';
import { formatXmlString } from '../../utils/xmlFormatter';

interface InvoiceDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: any;
    onRefresh: () => void;
    company?: any;
    onGenerateBoleto?: (invoice: any) => void;
}

export function InvoiceDetailModal({ isOpen, onClose, invoice, onRefresh, company, onGenerateBoleto }: InvoiceDetailModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const [modalSize, setModalSize] = useState<{ width: number; height: number } | null>(null);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const [events, setEvents] = useState<any[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isProtectedModalOpen, setIsProtectedModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'pdf' | 'xml' | 'details'>('details');
    const [xmlText, setXmlText] = useState<string>('');
    const [loadingXml, setLoadingXml] = useState(false);
    const [copiedXml, setCopiedXml] = useState(false);

    const [linkedCharge, setLinkedCharge] = useState<any>(null);
    const [loadingCharge, setLoadingCharge] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Definir tamanho inicial maior (ampliado por padrão) e resetar para a aba 'details' ao abrir
    useEffect(() => {
        if (isOpen) {
            setActiveTab('details');
            if (!modalSize) {
                const initialWidth = Math.min(window.innerWidth - 48, 1280);
                const initialHeight = Math.min(window.innerHeight - 48, 900);
                setModalSize({ width: initialWidth, height: initialHeight });
            }
        }
    }, [isOpen]);

    const [authToken, setAuthToken] = useState<string>('');

    // Recupera o token de sessão do Supabase para injetar no iframe do PDF
    useEffect(() => {
        if (isOpen) {
            const fetchToken = async () => {
                const session = (await supabase.auth.getSession()).data.session;
                if (session?.access_token) {
                    setAuthToken(session.access_token);
                }
            };
            fetchToken();
        }
    }, [isOpen]);

    // Manipulador do arrasto para redimensionamento livre do modal
    const handleStartResize = (e: React.MouseEvent, direction: 'corner' | 'right' | 'bottom') => {
        e.preventDefault();
        e.stopPropagation();
        if (isMaximized) setIsMaximized(false);

        setIsResizing(true);
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = modalRef.current?.offsetWidth || modalSize?.width || 1280;
        const startHeight = modalRef.current?.offsetHeight || modalSize?.height || 900;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            if (direction === 'corner' || direction === 'right') {
                newWidth = Math.max(640, Math.min(window.innerWidth - 24, startWidth + deltaX));
            }
            if (direction === 'corner' || direction === 'bottom') {
                newHeight = Math.max(480, Math.min(window.innerHeight - 24, startHeight + deltaY));
            }

            setModalSize({ width: newWidth, height: newHeight });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Buscar XML real descompactado quando a aba XML for selecionada
    useEffect(() => {
        if ((activeTab === 'xml' || activeTab === 'pdf') && !xmlText && invoice?.external_id) {
            setLoadingXml(true);
            const fetchXml = async () => {
                try {
                    const token = (await supabase.auth.getSession()).data.session?.access_token;
                    if (!token) return;
                    const blob = await fiscalService.downloadXML(invoice.external_id, invoice.type, invoice.company_id, token);
                    const text = await blob.text();
                    setXmlText(formatXmlString(text));
                } catch (err: any) {
                    console.error('Erro ao buscar XML:', err);
                    setXmlText('<!-- Não foi possível carregar o conteúdo do XML -->');
                } finally {
                    setLoadingXml(false);
                }
            };
            fetchXml();
        }
    }, [activeTab, invoice?.external_id, xmlText]);

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

    const fetchLinkedCharge = async () => {
        if (!invoice?.company_id) return;
        setLoadingCharge(true);
        try {
            const invoiceNo = invoice.invoice_number || invoice.external_id?.slice(-6) || '';
            
            let query = supabase
                .from('company_charges')
                .select('*')
                .eq('company_id', invoice.company_id)
                .order('created_at', { ascending: false });

            if (invoice.quote_id) {
                query = query.or(`quote_id.eq.${invoice.quote_id},external_reference.eq.NF${invoiceNo},description.ilike.%Nº ${invoiceNo}%`);
            } else if (invoiceNo) {
                query = query.or(`external_reference.eq.NF${invoiceNo},description.ilike.%Nº ${invoiceNo}%`);
            }

            const { data } = await query.limit(1);
            if (data && data.length > 0) {
                setLinkedCharge(data[0]);
            } else {
                setLinkedCharge(null);
            }
        } catch (err) {
            console.error('Erro ao buscar cobrança vinculada:', err);
        } finally {
            setLoadingCharge(false);
        }
    };

    const handleCopyToClipboard = (text: string, fieldName: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2500);
    };

    const formatDateSafe = (dateStr: any): string => {
        if (!dateStr) return 'Não informado';
        try {
            const raw = String(dateStr).trim();
            // Captura os dígitos de data YYYY-MM-DD ignorando hora e fuso horário
            const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                const [, year, month, day] = match;
                return `${day}/${month}/${year}`;
            }
            const parsed = new Date(raw);
            if (!isNaN(parsed.getTime())) {
                const day = String(parsed.getUTCDate()).padStart(2, '0');
                const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
                const year = parsed.getUTCFullYear();
                return `${day}/${month}/${year}`;
            }
            return raw;
        } catch {
            return String(dateStr);
        }
    };

    useEffect(() => {
        if (isOpen && invoice?.id) {
            fetchEvents();
            fetchLinkedCharge();
        }
    }, [invoice?.id, isOpen]);

    if (!isOpen || !invoice) return null;

    const payload = invoice.payload || {};
    const retorno = payload.retorno || {};

    // Extrair dados do cliente/tomador
    const clientName = invoice.quote?.contact?.name || 
                       payload.infDPS?.toma?.xNome ||
                       payload.toma?.xNome ||
                       payload.DPS?.infDPS?.toma?.xNome ||
                       retorno.infDPS?.toma?.xNome ||
                       payload.tomador?.razaoSocial || 
                       payload.destinatario?.razaoSocial || 
                       payload.destinatario?.nome || 
                       payload.borrower?.name || 
                       retorno.tomador?.razaoSocial ||
                       retorno.borrower?.name ||
                       (payload.noTomador || invoice.payload?.noTomador ? 'CONSUMIDOR FINAL' : 'CONSUMIDOR FINAL');
                       
    const clientTaxId = invoice.quote?.contact?.tax_id || 
                        payload.tomador?.cpfCnpj || 
                        payload.destinatario?.cpfCnpj || 
                        payload.destinatario?.cnpj || 
                        payload.borrower?.federalTaxNumber || 
                        retorno.borrower?.federalTaxNumber || 
                        '';

    const clientEmail = invoice.quote?.contact?.email || 
                         payload.tomador?.email || 
                         payload.destinatario?.email || 
                         payload.borrower?.email || 
                         retorno.borrower?.email || 
                         '';

    // Extrair dados do endereço
    const addr = payload.tomador?.endereco || payload.destinatario?.endereco || payload.borrower?.address || retorno.borrower?.address || {};
    const clientAddress = addr.logradouro 
        ? `${addr.logradouro}, ${addr.numero || 'S/N'}${addr.complemento ? ' - ' + addr.complemento : ''} - ${addr.bairro || ''}, ${addr.descricaoCidade || addr.cidade || ''}/${addr.estado || addr.uf || ''} (CEP: ${addr.cep || ''})`
        : '';

    const totalAmount = invoice.amount || 
                        payload.servicesAmount || 
                        payload.retorno?.servicesAmount || 
                        payload.retorno?.valorTotal || 
                        payload.infDPS?.valores?.vServPrest?.vServ ||
                        payload.valores?.vServPrest?.vServ ||
                        payload.retorno?.infDPS?.valores?.vServPrest?.vServ ||
                        payload.retorno?.valores?.vServPrest?.vServ ||
                        payload.servico?.[0]?.valor?.servico || 
                        payload.itens?.[0]?.valorUnitario?.comercial || 
                        payload.vServ ||
                        0;

    const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount);

    const description = payload.servico?.[0]?.discriminacao || 
                        payload.itens?.[0]?.descricao || 
                        'Prestação de serviço avulsa';

    const serviceItem = payload?.servico?.[0];
    
    // Alíquotas configuradas na Empresa (Prioridade Máxima)
    const cfg = company?.tecnospeed_config || {};
    
    // Resolve o regime tributário da nota quando ela foi emitida
    const invoiceRegime = payload.prestador?.regimeTributario !== undefined 
        ? String(payload.prestador.regimeTributario)
        : (payload.retorno?.prestador?.regimeTributario !== undefined 
            ? String(payload.retorno.prestador.regimeTributario)
            : String(cfg.regime_tributario || '1'));

    const isSimples = ['1', '2', '4'].includes(invoiceRegime);
    
    const cfgPis    = cfg.default_pis_aliquota    ? Number(cfg.default_pis_aliquota)    : null;
    const cfgCofins = cfg.default_cofins_aliquota ? Number(cfg.default_cofins_aliquota) : null;
    const cfgCsll   = cfg.default_csll_aliquota   ? Number(cfg.default_csll_aliquota)   : null;
    const cfgIrrf   = cfg.default_irrf_aliquota   ? Number(cfg.default_irrf_aliquota)   : null;
    const cfgIss    = cfg.default_iss_aliquota    ? Number(cfg.default_iss_aliquota)    : null;

    // ISS — Payload da Nota > Configuração da Empresa
    let issRate = 0;
    if (serviceItem?.iss?.aliquota !== undefined && serviceItem?.iss?.aliquota !== null && serviceItem?.iss?.aliquota !== '') {
        issRate = Number(serviceItem.iss.aliquota);
    } else if (payload?.issRate !== undefined && payload?.issRate !== null && payload?.issRate !== '') {
        const rawIss = Number(payload.issRate);
        issRate = rawIss < 1 ? rawIss * 100 : rawIss;
    } else if (cfgIss !== null) {
        issRate = cfgIss;
    }
    const issVal = totalAmount * (issRate / 100);

    // PIS — Payload da Nota > Configuração da Empresa
    let pisRate = 0;
    if (isSimples) {
        pisRate = 0;
    } else if (serviceItem?.pis?.aliquota !== undefined && serviceItem?.pis?.aliquota !== null && serviceItem?.pis?.aliquota !== '') {
        pisRate = Number(serviceItem.pis.aliquota);
    } else if (payload?.pisRate !== undefined && payload?.pisRate !== null && payload?.pisRate !== '') {
        const rawPis = Number(payload.pisRate);
        pisRate = rawPis < 1 ? rawPis * 100 : rawPis;
    } else if (cfgPis !== null) {
        pisRate = cfgPis;
    } else {
        pisRate = 0.65;
    }
    const pisVal = totalAmount * (pisRate / 100);

    // COFINS — Payload da Nota > Configuração da Empresa
    let cofinsRate = 0;
    if (isSimples) {
        cofinsRate = 0;
    } else if (serviceItem?.cofins?.aliquota !== undefined && serviceItem?.cofins?.aliquota !== null && serviceItem?.cofins?.aliquota !== '') {
        cofinsRate = Number(serviceItem.cofins.aliquota);
    } else if (payload?.cofinsRate !== undefined && payload?.cofinsRate !== null && payload?.cofinsRate !== '') {
        const rawCofins = Number(payload.cofinsRate);
        cofinsRate = rawCofins < 1 ? rawCofins * 100 : rawCofins;
    } else if (cfgCofins !== null) {
        cofinsRate = cfgCofins;
    } else {
        cofinsRate = 3;
    }
    const cofinsVal = totalAmount * (cofinsRate / 100);

    // CSLL — Payload da Nota > Configuração da Empresa
    let csllRate = 0;
    if (isSimples) {
        csllRate = 0;
    } else if (serviceItem?.csll?.aliquota !== undefined && serviceItem?.csll?.aliquota !== null && serviceItem?.csll?.aliquota !== '') {
        csllRate = Number(serviceItem.csll.aliquota);
    } else if (payload?.csllRate !== undefined && payload?.csllRate !== null && payload?.csllRate !== '') {
        const rawCsll = Number(payload.csllRate);
        csllRate = rawCsll < 1 ? rawCsll * 100 : rawCsll;
    } else if (cfgCsll !== null) {
        csllRate = cfgCsll;
    } else {
        csllRate = 1;
    }
    const csllVal = totalAmount * (csllRate / 100);

    // IRRF — Payload da Nota > Configuração da Empresa
    let irRate = 0;
    if (isSimples) {
        irRate = 0;
    } else if (serviceItem?.ir?.aliquota !== undefined && serviceItem?.ir?.aliquota !== null && serviceItem?.ir?.aliquota !== '') {
        irRate = Number(serviceItem.ir.aliquota);
    } else if (payload?.irRate !== undefined && payload?.irRate !== null && payload?.irRate !== '') {
        const rawIr = Number(payload.irRate);
        irRate = rawIr < 1 ? rawIr * 100 : rawIr;
    } else if (cfgIrrf !== null) {
        irRate = cfgIrrf;
    } else {
        irRate = 1.5;
    }
    const irVal = totalAmount * (irRate / 100);

    // INSS
    let inssRate = 0;
    if (serviceItem?.inss?.aliquota) {
        inssRate = Number(serviceItem.inss.aliquota);
    } else if (payload?.inssRate) {
        const rawInss = Number(payload.inssRate);
        inssRate = rawInss < 1 ? rawInss * 100 : rawInss;
    }
    const inssVal = totalAmount * (inssRate / 100);

    const totalRetenções = pisVal + cofinsVal + csllVal + irVal + inssVal;
    const netValue = totalAmount - totalRetenções; // Retenções Federais reduzem o recebido
    const formattedNetValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netValue);

    // Resolver Links de Documentos (Força uso do nosso gerador DANFSe v2.0 no servidor)
    const getDocUrl = (format: 'pdf' | 'xml'): string => {
        let apiBase = API_BASE_URL.replace(/\/$/, '');
        if (apiBase.startsWith('/')) {
            apiBase = window.location.origin + apiBase;
        }

        let base = '';
        if (format === 'xml' && invoice.xml_url && invoice.xml_url.startsWith('http') && !invoice.xml_url.includes('/fiscal-module/')) {
            base = invoice.xml_url;
        } else {
            const invType = invoice.type || 'national';
            const invId = invoice.external_id || invoice.access_key || invoice.id;
            base = `${apiBase}/fiscal-module/${invType}/${invId}/${format}?companyId=${invoice.company_id}`;
        }

        // Se for uma URL do nosso backend, anexa o token do usuário para passar pelo RLS do Supabase
        if (authToken && (base.includes('/fiscal-module/') || base.includes('/api/fiscal-module/'))) {
            const separator = base.includes('?') ? '&' : '?';
            return `${base}${separator}token=${encodeURIComponent(authToken)}`;
        }
        return base;
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
            a.download = getInvoiceFilename(invoice, format, company);
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

            const targetId = invoice.external_id || invoice.access_key || invoice.id;
            await fiscalService.cancelarNota(
                targetId,
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
            alert('Erro no cancelamento: ' + parseFiscalError(error));
            throw error;
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
            setShowCancelModal(false);
            setIsProtectedModalOpen(true);
            return;
        }

        await executeCancelInvoice();
    };

    // Excluir registro do histórico local (Soft Delete)
    const handleDeleteInvoice = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('fiscal_invoices').update({ deleted: true }).eq('id', invoice.id);
            if (error) throw error;
            
            setShowDeleteConfirm(false);
            onClose();
            onRefresh();
        } catch (error: any) {
            alert('Erro ao ocultar do histórico: ' + error.message);
        } finally {
            setIsDeleting(false);
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
            {/* Overlay transparente enquanto redimensiona para evitar retenção de eventos do mouse pelo iframe do PDF */}
            {isResizing && (
                <div className="fixed inset-0 z-[100] cursor-nwse-resize select-none" />
            )}

            <div 
                ref={modalRef}
                style={{
                    width: isMaximized ? '98vw' : (modalSize ? `${modalSize.width}px` : '95vw'),
                    height: isMaximized ? '98vh' : (modalSize ? `${modalSize.height}px` : '90vh'),
                    maxWidth: '98vw',
                    maxHeight: '98vh',
                    minWidth: '640px',
                    minHeight: '480px'
                }}
                className={`bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 flex flex-col relative animate-in zoom-in-95 duration-200 ${
                    isResizing ? 'select-none transition-none' : 'transition-all'
                }`}
            >
                
                {/* Header */}
                <div 
                    onDoubleClick={() => setIsMaximized(!isMaximized)}
                    className="flex flex-col border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 select-none cursor-default"
                    title="Clique duas vezes para maximizar ou restaurar"
                >
                    <div className="flex justify-between items-center p-6 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                                <Receipt size={22} />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                                    Nota Fiscal {invoice.invoice_number ? `Nº ${invoice.invoice_number}` : 'Avulsa'}
                                    <span className="text-xs font-black uppercase text-gray-400">({invoice.type})</span>
                                </h3>
                                <p className="text-xs text-gray-400 font-semibold truncate max-w-sm">ID: {invoice.external_id}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider ${statusStyle.bg}`}>
                                {statusStyle.icon}
                                {statusStyle.label}
                            </div>
                            <button 
                                onClick={() => setIsMaximized(!isMaximized)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                title={isMaximized ? "Restaurar tamanho" : "Maximizar"}
                            >
                                {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Navegação por Abas (PDF, XML, Detalhes) */}
                    <div className="flex items-center gap-2 px-6 pb-3">
                        <button
                            onClick={() => setActiveTab('pdf')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'pdf'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            <FileText size={15} />
                            📄 Documento DANFSe (PDF)
                        </button>
                        <button
                            onClick={() => setActiveTab('xml')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'xml'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            <FileCode size={15} />
                            💻 Arquivo XML Fiscal
                        </button>
                        <button
                            onClick={() => setActiveTab('details')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                activeTab === 'details'
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            <Receipt size={15} />
                            📊 Detalhes & Auditoria
                        </button>
                    </div>
                </div>

                {/* Main Tab Area */}
                {activeTab === 'pdf' && (
                    <div className="flex-1 min-h-0 flex flex-col p-4 bg-slate-900/5 dark:bg-slate-950/40 overflow-hidden">
                        <div className="flex items-center justify-between pb-3 px-2 flex-shrink-0">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                <FileText size={16} className="text-blue-500" />
                                Visualizando Documento Auxiliar DANFSe
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1.5 font-bold shadow-sm"
                                    onClick={() => {
                                        if (onGenerateBoleto) {
                                            onGenerateBoleto(invoice);
                                        } else {
                                            const params = new URLSearchParams({
                                                open: 'true',
                                                amount: (invoice.amount || (invoice as any).valor || 0).toString(),
                                                description: `Ref. Nota Fiscal Nº ${invoice.invoice_number || invoice.external_id?.slice(-6) || ''}`,
                                                contact_id: (invoice as any).customer_id || (invoice as any).contact_id || (invoice as any).quote?.contact_id || ''
                                            });
                                            window.location.href = `/dashboard/payments?${params.toString()}`;
                                        }
                                    }}
                                >
                                    <FileText size={14} className="mr-1" />
                                    Gerar Boleto Banco Inter
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownloadFile('pdf')}
                                    className="text-xs py-1.5"
                                >
                                    <FileText size={14} className="mr-1" />
                                    Baixar PDF
                                </Button>
                                {(() => {
                                    const key = invoice.access_key || (invoice.external_id?.length === 50 ? invoice.external_id : null);
                                    if (!key || key.length !== 50) return null;
                                    return (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => window.open(`https://www.nfse.gov.br/consultapublica/qr?chave=${key}`, '_blank')}
                                            className="text-xs py-1.5 border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                        >
                                            <ExternalLink size={14} className="mr-1" />
                                            Consultar no Portal
                                        </Button>
                                    );
                                })()}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(pdfUrl, '_blank')}
                                    className="text-xs py-1.5"
                                >
                                    <Printer size={14} className="mr-1" />
                                    Abrir em Nova Aba
                                </Button>
                            </div>
                        </div>
                        <div className="w-full flex-1 min-h-0 rounded-2xl border border-gray-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 overflow-hidden p-0 flex justify-center">
                            <iframe
                                src={pdfUrl}
                                className="w-full h-full rounded-2xl border-0 bg-white block"
                                title="Visualizador de PDF DANFSe v2.0"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'xml' && (
                    <div className="flex-1 flex flex-col p-4 bg-slate-950 text-slate-100 font-mono text-xs overflow-hidden">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                                <FileCode size={16} />
                                Conteúdo XML Autorizado da NFS-e
                            </span>
                            <div className="flex items-center gap-2 font-sans">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        navigator.clipboard.writeText(xmlText);
                                        setCopiedXml(true);
                                        setTimeout(() => setCopiedXml(false), 2000);
                                    }}
                                    className="text-xs py-1.5"
                                >
                                    {copiedXml ? 'Copiado! ✓' : 'Copiar XML'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownloadFile('xml')}
                                    className="text-xs py-1.5"
                                >
                                    Baixar XML
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 mt-3 scrollbar-thin">
                            {loadingXml ? (
                                <div className="flex items-center justify-center h-full text-slate-400 gap-2">
                                    <RefreshCw size={18} className="animate-spin text-blue-400" />
                                    Carregando XML oficial...
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap break-all leading-relaxed text-emerald-300/90 selection:bg-blue-500 selection:text-white">
                                    {xmlText || 'Carregando arquivo XML...'}
                                </pre>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'details' && (
                /* Content Details */
                <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-slate-800 overflow-hidden">
                    
                    {/* Left: General Info & Summary */}
                    <div className="col-span-2 p-6 space-y-6 overflow-y-auto h-full scrollbar-thin">
                        
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
                                <div className="flex flex-wrap gap-x-6 gap-y-2 items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Valor da Nota (Bruto):</span>
                                        <span className="text-lg font-black text-blue-600 dark:text-blue-400">{formattedAmount}</span>
                                    </div>
                                    {!isSimples && (
                                        <div className="flex flex-col text-right">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Valor Líquido Recebido:</span>
                                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formattedNetValue}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="pt-3 space-y-2 text-xs">
                                    <span className="text-gray-400 font-semibold uppercase tracking-widest text-[9px]">Detalhamento de Impostos Estimados:</span>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800 font-medium">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Valor Bruto:</span>
                                            <span className="font-bold text-gray-900 dark:text-white">{formattedAmount}</span>
                                        </div>
                                        {issVal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">ISS ({issRate}%):</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(issVal)}
                                                </span>
                                            </div>
                                        )}
                                        {pisVal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">PIS ({pisRate}%):</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pisVal)}
                                                </span>
                                            </div>
                                        )}
                                        {cofinsVal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">COFINS ({cofinsRate}%):</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cofinsVal)}
                                                </span>
                                            </div>
                                        )}
                                        {csllVal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">CSLL ({csllRate}%):</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(csllVal)}
                                                </span>
                                            </div>
                                        )}
                                        {irVal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">IRRF ({irRate}%):</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(irVal)}
                                                </span>
                                            </div>
                                        )}
                                        {inssVal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">INSS ({inssRate}%):</span>
                                                <span className="font-bold text-gray-700 dark:text-gray-300">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inssVal)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between col-span-2 pt-1.5 mt-1.5 border-t border-gray-100 dark:border-slate-800">
                                            <span className="text-gray-500 font-bold">Total Retenções Federais:</span>
                                            <span className="font-black text-rose-600 dark:text-rose-400">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRetenções)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between col-span-2 pt-1 border-t border-gray-100 dark:border-slate-800">
                                            <span className="text-gray-500 font-bold">Valor Líquido Recebido:</span>
                                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                {formattedNetValue}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-1 text-xs">
                                    <span className="text-gray-400 font-semibold uppercase tracking-widest text-[9px]">Discriminação / Itens:</span>
                                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800 max-h-24 overflow-y-auto scrollbar-thin">
                                        {description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* DADOS DE PAGAMENTO (COBRANÇA VINCULADA) */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                                    <CreditCard size={13} className="text-emerald-500" />
                                    Dados de Pagamento & Cobrança
                                </h4>
                                {linkedCharge && (
                                    <span className={clsx(
                                        "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                                        ['approved', 'paid'].includes(linkedCharge.status) && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
                                        ['pending'].includes(linkedCharge.status) && "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
                                        ['cancelled', 'rejected'].includes(linkedCharge.status) && "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                    )}>
                                        {['approved', 'paid'].includes(linkedCharge.status) ? '✓ Pago' :
                                         ['pending'].includes(linkedCharge.status) ? '⏳ Pendente' : '✕ Cancelado'}
                                    </span>
                                )}
                            </div>

                            {loadingCharge ? (
                                <div className="py-6 flex items-center justify-center gap-2 text-xs font-semibold text-gray-400">
                                    <RefreshCw size={14} className="animate-spin" />
                                    Buscando dados de pagamento...
                                </div>
                            ) : linkedCharge ? (
                                <div className="space-y-3.5">
                                    {/* Grid de Informações Chave */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50/70 dark:bg-slate-800/40 p-3.5 rounded-xl border border-gray-100 dark:border-slate-800/60">
                                        <div>
                                            <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">Valor do Boleto</span>
                                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(linkedCharge.amount || totalAmount)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">Vencimento</span>
                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                {formatDateSafe(linkedCharge.due_date || linkedCharge.due_date_at || linkedCharge.vencimento)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">Gateway / Provedor</span>
                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 capitalize">
                                                {linkedCharge.provider || 'Asaas'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Linha Digitável / Código de Barras */}
                                    {(linkedCharge.barcode || linkedCharge.linha_digitavel || linkedCharge.line_code) && (
                                        <div className="space-y-1.5">
                                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">
                                                Linha Digitável / Código de Barras do Boleto
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={linkedCharge.barcode || linkedCharge.linha_digitavel || linkedCharge.line_code}
                                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-gray-800 dark:text-gray-200 truncate select-all"
                                                />
                                                <Button
                                                    onClick={() => handleCopyToClipboard(linkedCharge.barcode || linkedCharge.linha_digitavel || linkedCharge.line_code, 'barcode')}
                                                    variant="outline"
                                                    className="h-9 px-3 text-xs font-bold flex items-center gap-1.5 shrink-0"
                                                >
                                                    {copiedField === 'barcode' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                    {copiedField === 'barcode' ? 'Copiado!' : 'Copiar'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Pix Copia e Cola */}
                                    {linkedCharge.qr_code && (
                                        <div className="space-y-1.5">
                                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                                <QrCode size={11} className="text-emerald-500" /> Pix Copia e Cola (Payload)
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={linkedCharge.qr_code}
                                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 truncate select-all"
                                                />
                                                <Button
                                                    onClick={() => handleCopyToClipboard(linkedCharge.qr_code, 'pix')}
                                                    variant="outline"
                                                    className="h-9 px-3 text-xs font-bold flex items-center gap-1.5 shrink-0 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                                >
                                                    {copiedField === 'pix' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                    {copiedField === 'pix' ? 'Copiado!' : 'Copiar Pix'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Imagem do QR Code Pix */}
                                    {linkedCharge.qr_code_base64 && (
                                        <div className="pt-2 flex flex-col items-center justify-center p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-800">
                                            <img 
                                                src={linkedCharge.qr_code_base64.startsWith('data:') ? linkedCharge.qr_code_base64 : `data:image/png;base64,${linkedCharge.qr_code_base64}`} 
                                                alt="QR Code Pix"
                                                className="w-36 h-36 object-contain rounded-lg border border-white dark:border-slate-700 shadow-sm" 
                                            />
                                            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-1.5">
                                                Escaneie com o app do seu banco para pagar via Pix
                                            </p>
                                        </div>
                                    )}

                                    {/* Botões para Ver Boleto / Link de Pagamento */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {(linkedCharge.payment_link || linkedCharge.bank_slip_url || linkedCharge.invoice_url) && (
                                            <a
                                                href={linkedCharge.payment_link || linkedCharge.bank_slip_url || linkedCharge.invoice_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                                            >
                                                <ExternalLink size={14} />
                                                Visualizar Boleto / Fatura em PDF
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700 text-center space-y-2">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                        Nenhum boleto ou cobrança bancária gerada para esta nota fiscal ainda.
                                    </p>
                                    {onGenerateBoleto && (
                                        <Button
                                            onClick={() => onGenerateBoleto(invoice)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-4 rounded-xl shadow-sm"
                                        >
                                            <DollarSign size={14} className="mr-1" />
                                            Gerar Boleto Bancário / Pix
                                        </Button>
                                    )}
                                </div>
                            )}
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
                    <div className="p-6 space-y-6 flex flex-col h-full overflow-y-auto scrollbar-thin bg-gray-50/30 dark:bg-slate-800/10">
                        
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
                                {linkedCharge && (linkedCharge.payment_link || linkedCharge.bank_slip_url || linkedCharge.invoice_url) && (
                                    <a
                                        href={linkedCharge.payment_link || linkedCharge.bank_slip_url || linkedCharge.invoice_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="col-span-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                                    >
                                        <ExternalLink size={14} />
                                        Ver Boleto / Fatura PDF
                                    </a>
                                )}
                                
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

                                {!['concluido', 'autorizado', 'cancelado'].includes(invoice.status?.toLowerCase()) && !invoice.deleted && (
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
                )}

                {/* Handles de Redimensionamento Interativo (Drag-to-Resize) */}
                {!isMaximized && (
                    <>
                        {/* Alça lateral direita */}
                        <div 
                            onMouseDown={(e) => handleStartResize(e, 'right')}
                            className="absolute top-0 right-0 w-2.5 h-full cursor-ew-resize hover:bg-blue-500/20 active:bg-blue-500/40 transition-colors z-20"
                            title="Arraste para ajustar a largura"
                        />
                        {/* Alça inferior */}
                        <div 
                            onMouseDown={(e) => handleStartResize(e, 'bottom')}
                            className="absolute bottom-0 left-0 w-full h-2.5 cursor-ns-resize hover:bg-blue-500/20 active:bg-blue-500/40 transition-colors z-20"
                            title="Arraste para ajustar a altura"
                        />
                        {/* Alça de canto inferior direito com ícone visual */}
                        <div 
                            onMouseDown={(e) => handleStartResize(e, 'corner')}
                            className="absolute bottom-1 right-1 w-7 h-7 cursor-nwse-resize flex items-center justify-center text-gray-400 hover:text-blue-500 hover:scale-110 active:scale-95 transition-all z-30 group"
                            title="Arraste aqui para redimensionar o modal"
                        >
                            <svg className="w-4.5 h-4.5 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M11 11h2v2h-2zM8 11h2v2H8zM11 8h2v2h-2zM5 11h2v2H5zM11 5h2v2h-2z" />
                            </svg>
                        </div>
                    </>
                )}

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
                            <AlertTriangle className="text-rose-500" size={20} /> Ocultar do Histórico
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 font-semibold leading-relaxed">
                            Tem certeza que deseja ocultar esta nota fiscal do seu painel principal?
                            Por motivos fiscais, de faturamento e auditoria, o registro não será deletado do banco de dados, mas ficará oculto. Você poderá consultá-lo ativando a opção "Mostrar Excluídas do Histórico" na listagem.
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
                onClose={(isSuccess) => {
                    setIsProtectedModalOpen(false);
                    if (!isSuccess) {
                        setShowCancelModal(true);
                    }
                }}
                onConfirm={executeCancelInvoice}
                transaction={{
                    description: `Cancelamento de Nota Fiscal Nº ${invoice.invoice_number || invoice.external_id}`,
                    paid_amount: totalAmount,
                    company_id: invoice.company_id
                }}
                invoiceNumber={invoice.invoice_number || invoice.external_id}
            />

            </div>
    );
}
