import { useState } from 'react';
import { Receipt, Plus, FileText, Download, AlertCircle, RefreshCw, Building2, Eye, FileCode, CheckCircle2, Clock3, XCircle, Trash2, Copy, AlertTriangle, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../components/ui/Button';
import { useInvoices } from '../hooks/useInvoices';
import { useEntity } from '../context/EntityContext';
import { fiscalService } from '../services/fiscalService';
import { supabase } from '../lib/supabase';
import { StandaloneInvoiceModal } from '../components/fiscal/StandaloneInvoiceModal';
import { ResultModal } from '../components/ui/ResultModal';
import { Tooltip } from '../components/ui/Tooltip';

export function Invoices() {
    const { invoices, isLoading, refresh } = useInvoices();
    const { currentEntity } = useEntity();
    
    console.log('🏢 [Invoices] Entidade Atual:', {
        id: currentEntity.id,
        name: currentEntity.name,
        cnpj: currentEntity.cnpj,
        type: currentEntity.type
    });
    const [showNewModal, setShowNewModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
    // Versão do Componente: v1.0.21 - Forçando deploy e refresh
    const [resultModal, setResultModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info'}>({
        isOpen: false, title: '', message: '', type: 'success'
    });
    const [cancelModal, setCancelModal] = useState<{isOpen: boolean, invoice: any | null}>({
        isOpen: false, invoice: null
    });
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, invoiceId: string | null}>({
        isOpen: false, invoiceId: null
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [duplicateData, setDuplicateData] = useState<{items: any[], type: 'nfse' | 'nfe', contactId: string, cityCode: string, notes: string} | null>(null);

    const handleViewPDF = async (externalId: string, companyId: string, type: 'nfse' | 'nfe', directUrl?: string) => {
        // Se já tivermos a URL direta (ex: PlugNotas CDN), abrimos em nova aba imediatamente
        if (directUrl && directUrl.startsWith('http')) {
            window.open(directUrl, '_blank');
            return;
        }

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            const blob = await fiscalService.downloadPDF(externalId, type, companyId, token);
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error: any) {
            console.error('Erro ao visualizar PDF:', error);
            setResultModal({
                isOpen: true,
                title: 'Erro na Visualização',
                message: 'Não foi possível carregar o PDF desta nota fiscal.',
                type: 'error'
            });
        }
    };

    const handleDownloadPDF = async (externalId: string, type: 'nfse' | 'nfe', companyId: string) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            const blob = await fiscalService.downloadPDF(externalId, type, companyId, token);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nota_${externalId}.pdf`;
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

    const handleDownloadXML = async (externalId: string, type: 'nfse' | 'nfe', companyId: string) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error('Sessão expirada.');
            const blob = await fiscalService.downloadXML(externalId, type, companyId, token);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nota_${externalId}.xml`;
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

    const handleCancelInvoice = async () => {
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
                message: error.response?.data?.detail?.message || error.message || 'Falha ao cancelar nota.',
                type: 'error'
            });
        } finally {
            setIsCancelling(false);
        }
    };

    const handleDeleteInvoice = async () => {
        if (!deleteModal.invoiceId) return;
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('fiscal_invoices').delete().eq('id', deleteModal.invoiceId);
            if (error) throw error;
            
            setDeleteModal({ isOpen: false, invoiceId: null });
            refresh();
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <Receipt size={24} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Notas Fiscais
                        </h1>
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
            {!isLoading && invoices.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Autorizadas</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">
                                {invoices.filter(i => ['concluido', 'autorizado'].includes(i.status?.toLowerCase())).length}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <Clock3 size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Processando</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">
                                {invoices.filter(i => ['processando', 'em_processamento'].includes(i.status?.toLowerCase())).length}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl">
                            <XCircle size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rejeitadas</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">
                                {invoices.filter(i => ['erro', 'rejeitado'].includes(i.status?.toLowerCase())).length}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                            <Receipt size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Geral</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{invoices.length}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Data e Hora</th>
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Tipo</th>
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Cliente / Beneficiário</th>
                                <th className="py-5 px-6 font-bold text-[10px] uppercase tracking-widest text-gray-400">Status da Emissão</th>
                                <th className="py-5 px-6 text-right font-bold text-[10px] uppercase tracking-widest text-gray-400">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
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
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
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
                                invoices.map((invoice) => (
                                    <tr key={invoice.id} className="group hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all duration-300">
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
                                                        {invoice.payload?.tomador?.razaoSocial || invoice.payload?.destinatario?.nome || 'Avulsa'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium mt-0.5 uppercase tracking-wider">Emissão Direta</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-6">
                                            <div className="flex flex-col gap-1.5 items-start">
                                                {getStatusBadge(invoice.status)}
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

                                                {invoice.external_id && (['processando', 'em_processamento'].includes(invoice.status?.toLowerCase())) && (
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

                                                {invoice.external_id && (['concluido', 'autorizado'].includes(invoice.status?.toLowerCase())) && (
                                                    <>
                                                        {invoice.pdf_url && (
                                                            <Tooltip content="Ver Link Externo">
                                                                <button
                                                                    onClick={() => window.open(invoice.pdf_url, '_blank')}
                                                                    className="h-10 w-10 flex items-center justify-center glass-morphism text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm"
                                                                >
                                                                    <ExternalLink size={18} />
                                                                </button>
                                                            </Tooltip>
                                                        )}

                                                        <Tooltip content="Visualizar PDF">
                                                            <button
                                                                onClick={() => handleViewPDF(invoice.external_id!, invoice.company_id, invoice.type, invoice.pdf_url)}
                                                                className="h-10 w-10 flex items-center justify-center glass-morphism text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all shadow-sm"
                                                            >
                                                                <Eye size={18} />
                                                            </button>
                                                        </Tooltip>

                                                        <Tooltip content="Cancelar na Prefeitura">
                                                            <button
                                                                onClick={() => setCancelModal({ isOpen: true, invoice })}
                                                                className="h-10 w-10 flex items-center justify-center glass-morphism text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all shadow-sm"
                                                            >
                                                                <XCircle size={18} />
                                                            </button>
                                                        </Tooltip>

                                                        <Tooltip content="Baixar PDF">
                                                            <button
                                                                onClick={() => handleDownloadPDF(invoice.external_id!, invoice.type, invoice.company_id)}
                                                                className="h-10 w-10 flex items-center justify-center glass-morphism text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all shadow-sm"
                                                            >
                                                                <Download size={18} />
                                                            </button>
                                                        </Tooltip>

                                                        <Tooltip content="Baixar XML">
                                                            <button
                                                                onClick={() => handleDownloadXML(invoice.external_id!, invoice.type, invoice.company_id)}
                                                                className="h-10 w-10 flex items-center justify-center glass-morphism text-orange-600 dark:text-orange-400 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-all shadow-sm"
                                                            >
                                                                <FileCode size={18} />
                                                            </button>
                                                        </Tooltip>
                                                    </>
                                                )}

                                                {/* Excluir do Histórico apenas se estiver cancelada ou com erro */}
                                                {(['cancelado', 'erro', 'rejeitado'].includes(invoice.status?.toLowerCase())) && (
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

            {/* Modal de Exclusão */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl">
                                <Trash2 size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Remover do Histórico</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Esta ação apagará apenas o registro local.</p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                            Tem certeza que deseja remover esta nota fiscal do seu histórico? 
                            A nota continuará existindo na prefeitura, mas não aparecerá mais neste painel.
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
