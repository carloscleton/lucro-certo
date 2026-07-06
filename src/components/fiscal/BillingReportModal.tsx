import { useState } from 'react';
import { Download, XCircle, CheckCircle2, Clock3, BarChart3, User, Building2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import type { FiscalInvoice } from '../../hooks/useInvoices';

interface BillingReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: FiscalInvoice[];
    fiscalSettings?: Record<string, any>;
}

export function BillingReportModal({ isOpen, onClose, invoices, fiscalSettings }: BillingReportModalProps) {
    const getFirstDayOfMonth = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    };

    const getToday = () => {
        return new Date().toISOString().split('T')[0];
    };

    // Helper para extrair o valor correto da nota fiscal (independente de NFe.io, TecnoSpeed, etc.)
    const getInvoiceAmount = (p: any): number => {
        if (!p) return 0;
        const servicos = Array.isArray(p.servico) ? p.servico : (p.servico ? [p.servico] : []);
        const val = p.servicesAmount || 
                    p.retorno?.servicesAmount || 
                    p.retorno?.valorTotal || 
                    servicos[0]?.valor?.servico || 
                    p.valorTotal || 
                    p.valorTotalBruto || 
                    0;
        return Number(val);
    };

    const [startDate, setStartDate] = useState(getFirstDayOfMonth());
    const [endDate, setEndDate] = useState(getToday());
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showTaxes, setShowTaxes] = useState(false);

    const calculateTaxesSummary = () => {
        let totalFaturado = 0;
        let totalIss = 0;
        let totalPis = 0;
        let totalCofins = 0;
        let totalCsll = 0;
        let totalIr = 0;

        // Alíquotas configuradas nas Configurações Fiscais (fallback primário)
        const cfgPis    = fiscalSettings?.default_pis_aliquota    ? Number(fiscalSettings.default_pis_aliquota)    : 0;
        const cfgCofins = fiscalSettings?.default_cofins_aliquota ? Number(fiscalSettings.default_cofins_aliquota) : 0;
        const cfgCsll   = fiscalSettings?.default_csll_aliquota   ? Number(fiscalSettings.default_csll_aliquota)   : 0;
        const cfgIrrf   = fiscalSettings?.default_irrf_aliquota   ? Number(fiscalSettings.default_irrf_aliquota)   : 0;
        const cfgIss    = fiscalSettings?.default_iss_aliquota    ? Number(fiscalSettings.default_iss_aliquota)    : 0;

        const authorizedInvoices = filteredInvoices.filter(i => 
            ['concluido', 'autorizado'].includes(i.status?.toLowerCase())
        );

        authorizedInvoices.forEach(i => {
            const amount = getInvoiceAmount(i.payload);
            totalFaturado += amount;

            const p = i.payload || {};
            const servicos = Array.isArray(p.servico) ? p.servico : (p.servico ? [p.servico] : []);
            const serviceItem = servicos[0];
            
            // ISS — payload da nota > configuração da empresa
            let issRate = 0;
            if (serviceItem?.iss?.aliquota) {
                issRate = Number(serviceItem.iss.aliquota);
            } else if (p.issRate) {
                const rawIss = Number(p.issRate);
                issRate = rawIss < 1 ? rawIss * 100 : rawIss;
            } else {
                issRate = cfgIss; // fallback: alíquota configurada
            }
            totalIss += amount * (issRate / 100);

            // PIS — payload da nota > configuração da empresa
            let pisRate = 0;
            if (serviceItem?.pis?.aliquota) {
                pisRate = Number(serviceItem.pis.aliquota);
            } else if (p.pisRate) {
                const rawPis = Number(p.pisRate);
                pisRate = rawPis < 1 ? rawPis * 100 : rawPis;
            } else {
                pisRate = cfgPis; // fallback: alíquota configurada
            }
            totalPis += amount * (pisRate / 100);

            // COFINS — payload da nota > configuração da empresa
            let cofinsRate = 0;
            if (serviceItem?.cofins?.aliquota) {
                cofinsRate = Number(serviceItem.cofins.aliquota);
            } else if (p.cofinsRate) {
                const rawCofins = Number(p.cofinsRate);
                cofinsRate = rawCofins < 1 ? rawCofins * 100 : rawCofins;
            } else {
                cofinsRate = cfgCofins; // fallback: alíquota configurada
            }
            totalCofins += amount * (cofinsRate / 100);

            // CSLL — payload da nota > configuração da empresa
            let csllRate = 0;
            if (serviceItem?.csll?.aliquota) {
                csllRate = Number(serviceItem.csll.aliquota);
            } else if (p.csllRate) {
                const rawCsll = Number(p.csllRate);
                csllRate = rawCsll < 1 ? rawCsll * 100 : rawCsll;
            } else {
                csllRate = cfgCsll; // fallback: alíquota configurada
            }
            totalCsll += amount * (csllRate / 100);

            // IRRF — payload da nota > configuração da empresa
            let irRate = 0;
            if (serviceItem?.ir?.aliquota) {
                irRate = Number(serviceItem.ir.aliquota);
            } else if (p.irRate) {
                const rawIr = Number(p.irRate);
                irRate = rawIr < 1 ? rawIr * 100 : rawIr;
            } else {
                irRate = cfgIrrf; // fallback: alíquota configurada
            }
            totalIr += amount * (irRate / 100);
        });

        const totalRetenções = totalPis + totalCofins + totalCsll + totalIr;
        const totalImpostos = totalIss + totalRetenções;

        return {
            totalFaturado,
            totalIss,
            totalPis,
            totalCofins,
            totalCsll,
            totalIr,
            totalRetenções,
            totalImpostos,
            netAmount: totalFaturado - totalImpostos
        };
    };

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
            const clientBorrower = p?.borrower?.name || p?.retorno?.borrower?.name || '';
            const clientName = (clientQuote || clientNfe || clientNfse || clientBorrower || 'Cliente Desconhecido').toLowerCase();

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
        
        // Valores das ativas/autorizadas
        authorizedAmount: filteredInvoices
            .filter(i => ['concluido', 'autorizado'].includes(i.status?.toLowerCase()))
            .reduce((acc, curr) => acc + getInvoiceAmount(curr.payload), 0),

        // Valores das canceladas
        cancelledAmount: filteredInvoices
            .filter(i => i.status?.toLowerCase() === 'cancelado')
            .reduce((acc, curr) => acc + getInvoiceAmount(curr.payload), 0),

        // Valores das em processamento
        processingAmount: filteredInvoices
            .filter(i => ['processando', 'em_processamento'].includes(i.status?.toLowerCase()))
            .reduce((acc, curr) => acc + getInvoiceAmount(curr.payload), 0),

        // Cobráveis: Notas autorizadas ou canceladas (ambas foram geradas com sucesso)
        billableCount: filteredInvoices.filter(i => ['concluido', 'autorizado', 'cancelado'].includes(i.status?.toLowerCase())).length,
        
        // Soma dos valores das notas cobráveis
        billableAmount: filteredInvoices
            .filter(i => ['concluido', 'autorizado', 'cancelado'].includes(i.status?.toLowerCase()))
            .reduce((acc, curr) => acc + getInvoiceAmount(curr.payload), 0)
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
                               p?.borrower?.name || 
                               p?.retorno?.borrower?.name || 
                               'Cliente';
                               
            const val = getInvoiceAmount(p);
            
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
                <div className="bg-gray-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-xs">
                    {/* Periodo */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Período:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-gray-400 text-xs font-medium">a</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 min-w-[150px] flex-grow sm:flex-grow-0">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="all">Todos os Status</option>
                            <option value="autorizada">Autorizadas / Ativas</option>
                            <option value="cancelada">Canceladas</option>
                            <option value="rejeitada">Rejeitadas / Erros</option>
                            <option value="processando">Em Processamento</option>
                        </select>
                    </div>

                    {/* Busca Rápida */}
                    <div className="flex items-center gap-2 flex-grow min-w-[200px]">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Busca:</span>
                        <input
                            type="text"
                            placeholder="Nota, cliente ou emissor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* Botão Painel Tributário */}
                    <Button
                        onClick={() => setShowTaxes(prev => !prev)}
                        variant="outline"
                        className={clsx(
                            "h-[32px] px-4 font-bold text-xs rounded-xl whitespace-nowrap transition-all md:ml-auto",
                            showTaxes 
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/20 dark:border-indigo-800"
                                : "border-gray-200 hover:bg-gray-50 text-gray-700 dark:border-slate-700 dark:hover:bg-slate-800"
                        )}
                    >
                        <Building2 size={14} className={clsx("mr-1.5", showTaxes ? "text-indigo-650 dark:text-indigo-400" : "text-indigo-500")} />
                        {showTaxes ? "Ocultar Impostos" : "Ver Impostos"}
                    </Button>

                    {/* Export Button */}
                    <Button
                        onClick={handleExportCSV}
                        variant="primary"
                        disabled={filteredInvoices.length === 0}
                        className="h-[32px] px-4 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/10 font-bold text-xs rounded-xl whitespace-nowrap"
                    >
                        <Download size={14} className="mr-1.5" />
                        Exportar CSV
                    </Button>
                </div>

                {/* 2. Key Metrics Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-semibold">ativas</span>
                        </div>
                        <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-2 font-medium">
                            Valor total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.authorizedAmount)}
                        </p>
                    </div>

                    <div className="bg-blue-500/5 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-500/10 shadow-sm">
                        <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Processando</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.processing}</span>
                            <span className="text-xs text-blue-600/70 dark:text-blue-400/70 font-semibold">em curso</span>
                        </div>
                        <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-2 font-medium">
                            Valor total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.processingAmount)}
                        </p>
                    </div>

                    <div className="bg-slate-500/5 dark:bg-slate-500/10 p-4 rounded-2xl border border-slate-500/10 shadow-sm">
                        <p className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1">Canceladas</p>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-slate-600 dark:text-slate-400">{stats.cancelled}</span>
                            <span className="text-xs text-slate-600/70 dark:text-slate-400/70 font-semibold">canceladas</span>
                        </div>
                        <p className="text-[10px] text-slate-600/80 dark:text-slate-400/80 mt-2 font-medium">
                            Valor total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.cancelledAmount)}
                        </p>
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

                {showTaxes && (() => {
                    const summary = calculateTaxesSummary();
                    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
                    const pct = (v: number) => summary.totalFaturado > 0 ? ((v / summary.totalFaturado) * 100).toFixed(2) : '0.00';

                    const federalTaxes = [
                        {
                            label: 'PIS',
                            fullLabel: 'PIS',
                            desc: 'Prog. de Integração Social',
                            value: summary.totalPis,
                            rate: fiscalSettings?.default_pis_aliquota ? Number(fiscalSettings.default_pis_aliquota) : null,
                            color: 'from-violet-500/10 to-violet-500/5',
                            border: 'border-violet-200 dark:border-violet-800/40',
                            textColor: 'text-violet-700 dark:text-violet-400',
                            badgeColor: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
                            dotColor: 'bg-violet-500',
                        },
                        {
                            label: 'COFINS',
                            fullLabel: 'COFINS',
                            desc: 'Contrib. p/ Financ. da Seguridade',
                            value: summary.totalCofins,
                            rate: fiscalSettings?.default_cofins_aliquota ? Number(fiscalSettings.default_cofins_aliquota) : null,
                            color: 'from-blue-500/10 to-blue-500/5',
                            border: 'border-blue-200 dark:border-blue-800/40',
                            textColor: 'text-blue-700 dark:text-blue-400',
                            badgeColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                            dotColor: 'bg-blue-500',
                        },
                        {
                            label: 'CSLL',
                            fullLabel: 'CSLL',
                            desc: 'Contrib. Social sobre Lucro Líquido',
                            value: summary.totalCsll,
                            rate: fiscalSettings?.default_csll_aliquota ? Number(fiscalSettings.default_csll_aliquota) : null,
                            color: 'from-orange-500/10 to-orange-500/5',
                            border: 'border-orange-200 dark:border-orange-800/40',
                            textColor: 'text-orange-700 dark:text-orange-400',
                            badgeColor: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
                            dotColor: 'bg-orange-500',
                        },
                        {
                            label: 'IRRF',
                            fullLabel: 'IRRF',
                            desc: 'Imposto de Renda Retido na Fonte',
                            value: summary.totalIr,
                            rate: fiscalSettings?.default_irrf_aliquota ? Number(fiscalSettings.default_irrf_aliquota) : null,
                            color: 'from-rose-500/10 to-rose-500/5',
                            border: 'border-rose-200 dark:border-rose-800/40',
                            textColor: 'text-rose-700 dark:text-rose-400',
                            badgeColor: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
                            dotColor: 'bg-rose-500',
                        },
                    ];

                    return (
                        <div className="bg-gradient-to-br from-indigo-50/20 via-white to-purple-50/15 dark:from-slate-900 dark:to-slate-900/60 p-5 rounded-2xl border border-indigo-150/40 dark:border-slate-800 shadow-sm animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 size={16} className="text-indigo-500" />
                                <h4 className="font-bold text-gray-900 dark:text-white text-xs">
                                    Resumo Tributário das Notas Autorizadas no Período
                                </h4>
                            </div>

                            {/* Top row — 4 summary cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                                <div className="bg-white/60 dark:bg-slate-950/20 p-3 rounded-xl border border-indigo-50/30 dark:border-slate-800/40">
                                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">Total Faturado (Autorizadas)</span>
                                    <span className="text-sm font-black text-gray-900 dark:text-white">{fmt(summary.totalFaturado)}</span>
                                </div>
                                <div className="bg-white/60 dark:bg-slate-950/20 p-3 rounded-xl border border-indigo-50/30 dark:border-slate-800/40">
                                    <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-0.5">ISS Calculado Estimado</span>
                                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">{fmt(summary.totalIss)}</span>
                                    {summary.totalFaturado > 0 && (
                                        <span className="text-[9px] text-blue-400 dark:text-blue-500 font-semibold block mt-0.5">{pct(summary.totalIss)}% do faturado</span>
                                    )}
                                </div>
                                <div className="bg-amber-50/60 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/30">
                                    <span className="text-[9px] font-bold text-amber-500 dark:text-amber-500 uppercase tracking-widest block mb-0.5">Total Retenções Federais</span>
                                    <span className="text-sm font-black text-amber-600 dark:text-amber-400">{fmt(summary.totalRetenções)}</span>
                                    {summary.totalFaturado > 0 && (
                                        <span className="text-[9px] text-amber-400 dark:text-amber-500 font-semibold block mt-0.5">{pct(summary.totalRetenções)}% do faturado</span>
                                    )}
                                </div>
                                <div className="bg-emerald-50/60 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30">
                                    <span className="text-[9px] font-bold text-emerald-500 dark:text-emerald-500 uppercase tracking-widest block mb-0.5">Líquido Recebido Estimado</span>
                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{fmt(summary.netAmount)}</span>
                                    {summary.totalFaturado > 0 && (
                                        <span className="text-[9px] text-emerald-400 dark:text-emerald-500 font-semibold block mt-0.5">{pct(summary.netAmount)}% do faturado</span>
                                    )}
                                </div>
                            </div>

                            {/* Federal taxes detail — cada imposto em card próprio */}
                            {summary.totalRetenções >= 0 && (
                                <div className="border-t border-indigo-100/40 dark:border-slate-800 pt-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Detalhamento das Retenções Federais</span>
                                        <div className="flex-1 h-px bg-amber-100 dark:bg-amber-900/30"></div>
                                        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/30">
                                            Total: {fmt(summary.totalRetenções)}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {federalTaxes.map((tax) => (
                                            <div
                                                key={tax.label}
                                                className={`bg-gradient-to-br ${tax.color} p-3.5 rounded-xl border ${tax.border} flex flex-col gap-2`}
                                            >
                                                {/* Header */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={`w-2 h-2 rounded-full ${tax.dotColor} flex-shrink-0`}></div>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${tax.textColor}`}>{tax.label}</span>
                                                    </div>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tax.badgeColor}`}>
                                                        {tax.rate !== null ? `${tax.rate}%` : `${pct(tax.value)}%`}
                                                    </span>
                                                </div>
                                                {/* Description */}
                                                <span className="text-[8px] text-gray-400 dark:text-gray-500 leading-tight font-medium">{tax.desc}</span>
                                                {/* Value */}
                                                <div className="mt-auto pt-1 border-t border-black/5 dark:border-white/5">
                                                    <span className={`text-base font-black ${tax.value > 0 ? tax.textColor : 'text-gray-300 dark:text-gray-600'}`}>
                                                        {fmt(tax.value)}
                                                    </span>
                                                    {summary.totalRetenções > 0 && tax.value > 0 && (
                                                        <span className="text-[8px] text-gray-400 dark:text-gray-500 block font-semibold">
                                                            {((tax.value / summary.totalRetenções) * 100).toFixed(1)}% das retenções
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

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
                                        const val = getInvoiceAmount(p);
                                        
                                        // Número/Chave
                                        const num = invoice.invoice_number || p?.retorno?.numeroNfse || p?.numeroNfse || p?.numeroNfe || p?.retorno?.numero || p?.numero;
                                        const ident = num ? `Nº ${num}` : (invoice.external_id?.slice(0, 8) || 'Sem ID');
                                        
                                        // Cliente
                                        const clientName = invoice.quote?.contact?.name || 
                                                           p?.tomador?.razaoSocial || 
                                                           p?.tomador?.nome || 
                                                           p?.destinatario?.nome || 
                                                           p?.borrower?.name || 
                                                           p?.retorno?.borrower?.name || 
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
