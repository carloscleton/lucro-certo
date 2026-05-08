import { useState } from 'react';
import { Receipt, Plus, FileText, Download, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useInvoices } from '../hooks/useInvoices';
import { useEntity } from '../context/EntityContext';
import { fiscalService } from '../services/fiscalService';
import { supabase } from '../lib/supabase';
import { StandaloneInvoiceModal } from '../components/fiscal/StandaloneInvoiceModal';

export function Invoices() {
    const { invoices, isLoading, refresh } = useInvoices();
    const { currentEntity } = useEntity();
    const [showNewModal, setShowNewModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

    const handleDownloadPDF = async (externalId: string, companyId: string) => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) return;
            const blob = await fiscalService.downloadPDF(externalId, companyId, token);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nota_${externalId}.pdf`;
            a.click();
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Falha ao baixar PDF da nota.');
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
        } catch (error) {
            console.error('Error checking status:', error);
            alert('Falha ao atualizar status da nota.');
        } finally {
            setIsRefreshing(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'concluido':
            case 'autorizado':
                return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">Autorizada</span>;
            case 'processando':
            case 'em_processamento':
                return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">Processando</span>;
            case 'erro':
            case 'rejeitado':
                return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">Rejeitada</span>;
            case 'cancelado':
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">Cancelada</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">{status || 'Pendente'}</span>;
        }
    };

    if (currentEntity.type === 'personal') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4 animate-in fade-in">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4">
                    <Receipt size={48} className="text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Módulo Fiscal</h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md">
                    Selecione uma empresa no topo da página para gerenciar notas fiscais.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Receipt className="text-blue-600" />
                        Notas Fiscais
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Histórico de NF-e e NFS-e emitidas pela sua empresa
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={refresh} className="bg-white dark:bg-slate-800">
                        <RefreshCw size={16} className="mr-2" />
                        Atualizar
                    </Button>
                    <Button variant="primary" onClick={() => setShowNewModal(true)} className="bg-blue-600 hover:bg-blue-700">
                        <Plus size={16} className="mr-2" />
                        Nova Nota Avulsa
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-slate-700">
                            <tr>
                                <th className="py-3 px-4 font-medium">Data</th>
                                <th className="py-3 px-4 font-medium">Tipo</th>
                                <th className="py-3 px-4 font-medium">Cliente/Origem</th>
                                <th className="py-3 px-4 font-medium">Status</th>
                                <th className="py-3 px-4 text-right font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-500">
                                        <Loader2 size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
                                        Carregando notas...
                                    </td>
                                </tr>
                            ) : invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Receipt size={32} className="text-gray-300 dark:text-slate-600 mb-2" />
                                            <p>Nenhuma nota fiscal encontrada.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                invoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="py-3 px-4">
                                            {new Date(invoice.created_at).toLocaleDateString()}
                                            <div className="text-xs text-gray-400">
                                                {new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="font-medium uppercase">{invoice.type}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {invoice.quote ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                                        {invoice.quote.contact?.name || 'Cliente'}
                                                    </span>
                                                    <span className="text-xs text-blue-600 flex items-center gap-1">
                                                        <FileText size={10} />
                                                        Orçamento #{invoice.quote.quote_number || invoice.quote_id?.slice(0, 8)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                                        {invoice.payload?.tomador?.razaoSocial || invoice.payload?.destinatario?.nome || 'Avulsa'}
                                                    </span>
                                                    <span className="text-xs text-gray-500">Emissão Direta</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(invoice.status)}
                                                {invoice.error_message && (
                                                    <div title={invoice.error_message} className="cursor-help flex items-center justify-center">
                                                        <AlertCircle size={14} className="text-red-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                {invoice.external_id && (invoice.status === 'processando' || invoice.status === 'em_processamento') && (
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => handleRefreshStatus(invoice)}
                                                        disabled={isRefreshing === invoice.id}
                                                        className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                                                        title="Sincronizar Status"
                                                    >
                                                        <RefreshCw size={14} className={isRefreshing === invoice.id ? 'animate-spin' : ''} />
                                                    </Button>
                                                )}
                                                
                                                {invoice.external_id && (invoice.status === 'concluido' || invoice.status === 'autorizado') && (
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => handleDownloadPDF(invoice.external_id!, invoice.company_id)}
                                                        className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                                                        title="Baixar PDF"
                                                    >
                                                        <Download size={16} />
                                                    </Button>
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
                    onClose={() => setShowNewModal(false)} 
                    onSuccess={() => {
                        setShowNewModal(false);
                        refresh();
                    }} 
                />
            )}
        </div>
    );
}
