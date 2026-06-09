import { useState } from 'react';
import { Calendar, Download, Search, XCircle, CheckCircle2, Clock3, BarChart3, Filter, User } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import type { FiscalInvoice } from '../../hooks/useInvoices';

interface BillingReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: FiscalInvoice[];
}

export function BillingReportModal({ isOpen, onClose, invoices }: BillingReportModalProps) {
    const getFirstDayOfMonth = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    };

    const getToday = () => {
        return new Date().toISOString().split('T')[0];
    };

    const [startDate, setStartDate] = useState(getFirstDayOfMonth());
    const [endDate, setEndDate] = useState(getToday());
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Filtragem das notas por período, status e termo de busca
    const filteredInvoices = invoices.filter(invoice => {
        // 1. Filtro de Data (usando a data de criação da nota)
        const invoiceDateStr = invoice.created_at.split('T')[0];
        if (invoiceDateStr < startDate || invoiceDateStr > endDate) {
            return false;
        }

        // 2. Filtro de Status
        const status = invoice.status?.toLowerCase() || '';
        if (statusFilter !== 'all') {
            if (statusFilter === 'autorizada') {
                if (!['concluido', 'autorizado'].includes(status)) return false;
            } else if (statusFilter === 'cancelada') {
                if (status !== 'cancelado') return false;
            } else if (statusFilter === 'rejeitada') {
                if (!['erro', 'rejeitado'].includes(status)) return false;
            } else if (statusFilter === 'processando') {
                if (!['processando', 'em_processamento'].includes(status)) return false;
            }
        }

        // 3. Filtro de Busca (Número da nota, Cliente ou Emissor)
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const p = invoice.payload;
            
            const clientQuote = invoice.quote?.contact?.name || '';
            const clientNfe = p?.destinatario?.nome || '';
            const clientNfse = p?.tomador?.razaoSocial || p?.tomador?.nome || '';
            const clientName = (clientQuote || clientNfe || clientNfse || 'Cliente Desconhecido').toLowerCase();

            const invoiceNum = (invoice.invoice_number || p?.retorno?.numeroNfse || p?.numeroNfse || p?.numeroNfe || p?.retorno?.numero || p?.numero || invoice.external_id || '').toLowerCase();
            const creatorName = (invoice.created_by_profile?.full_name || '').toLowerCase();
            const creatorEmail = (invoice.created_by_profile?.email || '').toLowerCase();

            return clientName.includes(query) || invoiceNum.includes(query) || creatorName.includes(query) || creatorEmail.includes(query);
        }

        return true;
    });

    // Cálculos de Resumo com base no filtro atual
    const stats = {
        totalEmitted: filteredInvoices.length,
        authorized: filteredInvoices.filter(i => ['concluido', 'autorizado'].includes(i.status?.toLowerCase())).length,
        cancelled: filteredInvoices.filter(i => i.status?.toLowerCase() === 'cancelado').length,
        rejected: filteredInvoices.filter(i => ['erro', 'rejeitado'].includes(i.status?.toLowerCase())).length,
        processing: filteredInvoices.filter(i => ['processando', 'em_processamento'].includes(i.status?.toLowerCase())).length,
        
        // Cobráveis: Notas autorizadas ou canceladas (ambas foram geradas com sucesso)
        billableCount: filteredInvoices.filter(i => ['concluido', 'autorizado', 'cancelado'].includes(i.status?.toLowerCase())).length,
        
        // Soma dos valores das notas cobráveis
        billableAmount: filteredInvoices
            .filter(i => ['concluido', 'autorizado', 'cancelado'].includes(i.status?.toLowerCase()))
            .reduce((acc, curr) => {
                const p = curr.payload;
                if (!p) return acc;
                const servicos = Array.isArray(p.servico) ? p.servico : (p.servico ? [p.servico] : []);
                const val = servicos[0]?.valor?.servico || p?.valorTotal || p?.valorTotalBruto || p?.retorno?.valorTotal || 0;
                return acc + Number(val);
            }, 0)
    };

    // Exportação em formato CSV com suporte UTF-8 BOM
    const handleExportCSV = () => {
        const headers = [
            'Data Emissao',
            'Tipo',
            'Identificacao',
            'Cliente',
            'Valor (R$)',
            'Emissor',
            'Status da Emissao',
            'Data Cancelamento',
            'Quem Cancelou',
            'Justificativa do Cancelamento'
        ];

        const rows = filteredInvoices.map(inv => {
            const dateEmissao = new Date(inv.created_at).toLocaleString('pt-BR');
            const tipo = inv.type.toUpperCase();
            
            const p = inv.payload;
            const num = inv.invoice_number || p?.retorno?.numeroNfse || p?.numeroNfse || p?.numeroNfe || p?.retorno?.numero || p?.numero || '';
            const ident = num ? `Nº ${num}` : (inv.external_id || '');
            
            const clientName = inv.quote?.contact?.name || 
                               p?.tomador?.razaoSocial || 
                               p?.destinatario?.nome || 
                               'Cliente';
                               
            const servicos = p ? (Array.isArray(p.servico) ? p.servico : (p.servico ? [p.servico] : [])) : [];
            const val = servicos[0]?.valor?.servico || p?.valorTotal || p?.valorTotalBruto || p?.retorno?.valorTotal || 0;
            
            const emissor = inv.created_by_profile?.full_name || inv.created_by_profile?.email || 'N/A';
            const status = inv.status;
            
            const dateCancel = inv.cancelled_at ? new Date(inv.cancelled_at).toLocaleString('pt-BR') : '';
            const quemCancelou = inv.cancelled_by_profile?.full_name || inv.cancelled_by_profile?.email || '';
            const justificativa = inv.cancellation_reason || p?.cancelamento?.justificativa || '';
            
            return [
                dateEmissao,
                tipo,
                ident,
                clientName,
                Number(val).toFixed(2).replace('.', ','),
                emissor,
                status.toUpperCase(),
                dateCancel,
                quemCancelou,
                justificativa
            ];
        });

        const csvContent = [
            headers.join(';'),
            ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
        ].join('\n');

        // Adiciona UTF-8 BOM para abrir corretamente no Excel
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_emissao_notas_${startDate}_a_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusBadge = (status: string) => {
        const s = status?.toLowerCase();
        if (s === 'concluido' || s === 'autorizado') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 size={10} /> Autorizada
                </span>
            );
        }
        if (s === 'processando' || s === 'em_processamento') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-500/20">
                    <Clock3 size={10} className="animate-spin" /> Processando
                </span>
            );
        }
        if (s === 'erro' || s === 'rejeitado') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-500/20">
                    <XCircle size={10} /> Rejeitada
                </span>
            );
        }
        if (s === 'cancelado') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 dark:bg-slate-500/20 text-slate-500 dark:text-slate-400 rounded-lg border border-slate-500/20">
                    <XCircle size={10} /> Cancelada
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-gray-500/10 text-gray-500 rounded-lg border border-gray-500/20">
                <Clock3 size={10} /> Pendente
            </span>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Relatório de Cobrança por Notas Fiscais"
            subtitle="Painel de auditoria, contagem e exportação para controle de cobrança de notas emitidas e canceladas"
            icon={BarChart3}
            variant="info"
            maxWidth="max-w-6xl"
        >
            <div className="space-y-6">
                {/* 1. Date and Status Filters */}
                <div className="bg-gray-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-end">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-grow w-full md:w-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-0.5">Data Inicial</label>
                            <div className="relative">
                                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-0.5">Data Final</label>
                            <div className="relative">
                                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-grow w-full md:w-auto">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-0.5">Filtrar Status</label>
                            <div className="relative">
                                <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full pl-10 pr-8 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                                >
                                    <option value="all">Todos os Status</option>
                                    <option value="autorizada">Autorizadas / Concluídas</option>
                                    <option value="cancelada">Canceladas</option>
                                    <option value="rejeitada">Rejeitadas / Erros</option>
                                    <option value="processando">Em Processamento</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-0.5">Busca Rápida</label>
                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Nota, cliente ou emissor..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={handleExportCSV}
                        variant="primary"
                        disabled={filteredInvoices.length === 0}
                        className="h-[38px] w-full md:w-auto bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/10 font-bold text-xs shrink-0 rounded-xl"
                    >
                        <Download size={16} className="mr-2" />
                        Exportar CSV
                    </Button>
                </div>

                {/* 2. Key Metrics Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Período</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-gray-900 dark:text-white">{stats.totalEmitted}</span>
                            <span className="text-xs text-gray-400">emissões</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">Todas as notas processadas</p>
                    </div>

                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/10 shadow-sm">
                        <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Autorizadas</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.authorized}</span>
                            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70">ativas</span>
                        </div>
                        <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-2">Emissão com sucesso</p>
                    </div>

                    <div className="bg-slate-500/5 dark:bg-slate-500/10 p-4 rounded-2xl border border-slate-500/10 shadow-sm">
                        <p className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1">Canceladas</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-slate-600 dark:text-slate-400">{stats.cancelled}</span>
                            <span className="text-xs text-slate-600/70 dark:text-slate-400/70">canceladas</span>
                        </div>
                        <p className="text-[10px] text-slate-600/80 dark:text-slate-400/80 mt-2">Computadas na cobrança</p>
                    </div>

                    <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-500/10 text-white">
                        <p className="text-[9px] font-black text-blue-100 uppercase tracking-widest mb-1">Total Cobrável</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-white">{stats.billableCount}</span>
                            <span className="text-xs text-blue-100 font-bold">notas</span>
                        </div>
                        <p className="text-[10px] text-blue-100/90 mt-2 font-medium">
                            Valor total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.billableAmount)}
                        </p>
                    </div>
                </div>

                {/* 3. Detailed Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto max-h-[40vh] scrollbar-thin">
                        <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300 relative">
                            <thead className="sticky top-0 bg-gray-50 dark:bg-slate-800 z-10 border-b border-gray-100 dark:border-slate-700">
                                <tr>
                                    <th className="py-3.5 px-4 font-bold uppercase tracking-widest text-[9px] text-gray-400">Emissão / Tipo</th>
                                    <th className="py-3.5 px-4 font-bold uppercase tracking-widest text-[9px] text-gray-400">Identificação</th>
                                    <th className="py-3.5 px-4 font-bold uppercase tracking-widest text-[9px] text-gray-400">Cliente / Beneficiário</th>
                                    <th className="py-3.5 px-4 font-bold uppercase tracking-widest text-[9px] text-gray-400">Emissor</th>
                                    <th className="py-3.5 px-4 font-bold uppercase tracking-widest text-[9px] text-gray-400">Status</th>
                                    <th className="py-3.5 px-4 font-bold uppercase tracking-widest text-[9px] text-gray-400">Cancelamento (Data/Quem/Motivo)</th>
                                    <th className="py-3.5 px-4 text-right font-bold uppercase tracking-widest text-[9px] text-gray-400">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                {filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                                            Nenhuma nota fiscal encontrada para os filtros selecionados.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInvoices.map((invoice) => {
                                        const p = invoice.payload;
                                        
                                        // Valor
                                        const servicos = p ? (Array.isArray(p.servico) ? p.servico : (p.servico ? [p.servico] : [])) : [];
                                        const val = servicos[0]?.valor?.servico || p?.valorTotal || p?.valorTotalBruto || p?.retorno?.valorTotal || 0;
                                        
                                        // Número/Chave
                                        const num = invoice.invoice_number || p?.retorno?.numeroNfse || p?.numeroNfse || p?.numeroNfe || p?.retorno?.numero || p?.numero;
                                        const ident = num ? `Nº ${num}` : (invoice.external_id?.slice(0, 8) || 'Sem ID');
                                        
                                        // Cliente
                                        const clientName = invoice.quote?.contact?.name || 
                                                           p?.tomador?.razaoSocial || 
                                                           p?.tomador?.nome || 
                                                           p?.destinatario?.nome || 
                                                           'Cliente';

                                        // Cancelamento info
                                        const isCancelled = invoice.status?.toLowerCase() === 'cancelado';
                                        
                                        return (
                                            <tr key={invoice.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-gray-900 dark:text-white">
                                                        {new Date(invoice.created_at).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(invoice.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 text-[9px] font-black rounded uppercase tracking-wider">
                                                        {invoice.type}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 font-mono font-bold text-gray-800 dark:text-gray-200">
                                                    {ident}
                                                </td>
                                                <td className="py-3.5 px-4 max-w-[150px] truncate">
                                                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs">
                                                        {clientName}
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                                                        <User size={12} className="text-gray-400" />
                                                        <div className="truncate max-w-[120px]">
                                                            <span className="font-semibold">{invoice.created_by_profile?.full_name || 'Sistema'}</span>
                                                            <span className="block text-[9px] text-gray-400 truncate">{invoice.created_by_profile?.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    {getStatusBadge(invoice.status)}
                                                </td>
                                                <td className="py-3.5 px-4 max-w-[200px]">
                                                    {isCancelled ? (
                                                        <div className="space-y-1 text-[11px] leading-tight">
                                                            <div className="text-slate-700 dark:text-slate-300 font-semibold flex flex-col">
                                                                <span>📅 {invoice.cancelled_at ? new Date(invoice.cancelled_at).toLocaleString('pt-BR') : 'Sem data'}</span>
                                                                <span className="text-[10px] text-slate-500 font-medium mt-0.5">👤 {invoice.cancelled_by_profile?.full_name || invoice.cancelled_by_profile?.email || 'N/A'}</span>
                                                            </div>
                                                            {invoice.cancellation_reason && (
                                                                <Tooltip content={invoice.cancellation_reason}>
                                                                    <div className="text-[9px] text-slate-400 bg-slate-50 dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700 truncate cursor-help">
                                                                        💬 {invoice.cancellation_reason}
                                                                    </div>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic font-medium">Ativa / Sem cancelamento</span>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 text-right font-bold text-gray-900 dark:text-white text-xs">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. Footer */}
                <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest pt-2">
                    <div>
                        {filteredInvoices.length} nota{filteredInvoices.length === 1 ? '' : 's'} no período
                    </div>
                    <div>
                        Lucro Certo Module
                    </div>
                </div>
            </div>
        </Modal>
    );
}
