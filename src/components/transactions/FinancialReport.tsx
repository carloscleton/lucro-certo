import React from 'react';
import type { Transaction } from '../../hooks/useTransactions';

interface FinancialReportProps {
    transactions: Transaction[];
    type: 'expense' | 'income';
    title: string;
    startDate: string;
    endDate: string;
    entityName: string;
    logoUrl?: string;
}

export const FinancialReport = React.forwardRef<HTMLDivElement, FinancialReportProps>(({
    transactions,
    type,
    title,
    startDate,
    endDate,
    entityName,
    logoUrl
}, ref) => {

    const total = transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
    const paidTotal = transactions
        .filter(t => t.status === 'paid' || t.status === 'received')
        .reduce((acc, t) => acc + (t.amount || 0), 0);
    const pendingTotal = transactions
        .filter(t => t.status === 'pending' || t.status === 'late')
        .reduce((acc, t) => acc + (t.amount || 0), 0);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(value);
    };

    return (
        <div ref={ref} className="p-8 bg-white text-slate-900 font-sans report-container">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6 mb-8">
                <div className="flex items-center gap-4">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain" />
                    ) : (
                        <div className="h-16 w-16 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-2xl">
                            {entityName?.charAt(0)}
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-tight">{entityName}</h1>
                        <p className="text-slate-500 text-sm font-medium">Relatório de Transações Financeiras</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold text-slate-800">{title}</div>
                    <div className="text-xs text-slate-500 font-medium">
                        Período: {formatDate(startDate)} até {formatDate(endDate)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
                        Gerado em: {new Date().toLocaleString(window.__CURRENCY_LOCALE__ || "pt-BR")}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">Total Geral</div>
                    <div className="text-xl font-bold text-slate-900">{formatCurrency(total)}</div>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="text-[10px] text-emerald-600 uppercase font-bold mb-1">Total {type === 'income' ? 'Recebido' : 'Pago'}</div>
                    <div className="text-xl font-bold text-emerald-700">{formatCurrency(paidTotal)}</div>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="text-[10px] text-amber-600 uppercase font-bold mb-1">Total Pendente</div>
                    <div className="text-xl font-bold text-amber-700">{formatCurrency(pendingTotal)}</div>
                </div>
            </div>

            {/* Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600">
                            <th className="px-4 py-3 font-bold uppercase tracking-wider">Data</th>
                            <th className="px-4 py-3 font-bold uppercase tracking-wider">Descrição / Cliente</th>
                            <th className="px-4 py-3 font-bold uppercase tracking-wider">Categoria</th>
                            <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Status</th>
                            <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {transactions.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
                                    {formatDate(t.date)}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="font-bold text-slate-900">{t.description}</div>
                                    <div className="text-[10px] text-slate-500">{(t.contact as any)?.name || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-500 font-medium">
                                    {(t.category as any)?.name || 'Sem categoria'}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${t.status === 'paid' || t.status === 'received'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : t.status === 'pending'
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}>
                                        {t.status === 'received' ? 'RECEBIDO' : t.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className={`px-4 py-3 text-right font-bold ${type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                                    }`}>
                                    {formatCurrency(t.amount || 0)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                            <td colSpan={4} className="px-4 py-4 text-right font-bold text-slate-600 uppercase tracking-wider">
                                Total Acumulado:
                            </td>
                            <td className="px-4 py-4 text-right font-bold text-slate-900 text-sm">
                                {formatCurrency(total)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between uppercase tracking-widest font-medium">
                <span>Plataforma Lucro Certo - Sistema de Gestão Inteligente</span>
                <span>Página 1 de 1</span>
            </div>

            <style>{`
                @media print {
                    @page { margin: 20mm; size: A4; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .report-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                }
            `}</style>
        </div>
    );
});

FinancialReport.displayName = 'FinancialReport';
