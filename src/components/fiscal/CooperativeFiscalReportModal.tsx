import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { 
    Building2, 
    Calendar, 
    Download, 
    Printer, 
    ShieldCheck, 
    TrendingUp, 
    Layers
} from 'lucide-react';

interface CooperativeFiscalReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoices: any[];
    companyName: string;
}

export function CooperativeFiscalReportModal({ isOpen, onClose, invoices, companyName }: CooperativeFiscalReportModalProps) {
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    // Filtra e calcula relatórios da cooperativa por tipo de ato (Ato Cooperado vs. Taxa Adm)
    const reportData = useMemo(() => {
        const filtered = invoices.filter(inv => {
            const dateStr = inv.issue_date || inv.created_at || '';
            if (!dateStr) return false;
            const invDate = dateStr.split('T')[0];
            return invDate >= startDate && invDate <= endDate && inv.status !== 'cancelled';
        });

        let totalAtoCooperadoVal = 0;
        let countAtoCooperado = 0;

        let totalTaxaAdmVal = 0;
        let countTaxaAdm = 0;
        let totalIssTaxaAdm = 0;

        const detailedList: any[] = [];

        filtered.forEach(inv => {
            const regSpec = String(inv.regime_especial_tributacao || inv.regimeEspecialTributacao || inv.payload?.prestador?.regimeEspecialTributacao || '0');
            const isAtoCooperado = regSpec === '4' || (inv.description || inv.notes || '').toLowerCase().includes('cooperad');
            
            const amount = parseFloat(inv.total_amount || inv.amount || inv.total || 0);
            const issRate = parseFloat(inv.iss_rate || inv.aliquota_iss || 5.0);
            const issValue = isAtoCooperado ? 0 : (amount * (issRate / 100));

            if (isAtoCooperado) {
                totalAtoCooperadoVal += amount;
                countAtoCooperado += 1;
            } else {
                totalTaxaAdmVal += amount;
                countTaxaAdm += 1;
                totalIssTaxaAdm += issValue;
            }

            detailedList.push({
                id: inv.id,
                number: inv.number || inv.invoice_number || inv.dps_number || 'N/A',
                date: (inv.issue_date || inv.created_at || '').split('T')[0],
                contact: inv.customer_name || inv.contact_name || inv.tomador_name || 'Tomador',
                regimeType: isAtoCooperado ? 'Ato Cooperado (Serviços)' : 'Ato Não Cooperado (Taxa Adm)',
                isAtoCooperado,
                amount,
                issRate: isAtoCooperado ? 0 : issRate,
                issValue
            });
        });

        return {
            totalInvoices: filtered.length,
            totalGrossVolume: totalAtoCooperadoVal + totalTaxaAdmVal,
            totalAtoCooperadoVal,
            countAtoCooperado,
            totalTaxaAdmVal,
            countTaxaAdm,
            totalIssTaxaAdm,
            detailedList
        };
    }, [invoices, startDate, endDate]);

    const handleExportCSV = () => {
        const headers = ['Data Emissão', 'Número Nota/DPS', 'Tomador/Cliente', 'Tipo de Ato', 'Valor Bruto (R$)', 'Alíquota ISS (%)', 'Valor ISS (R$)'];
        const rows = reportData.detailedList.map(item => [
            item.date,
            `"${item.number}"`,
            `"${item.contact.replace(/"/g, '""')}"`,
            `"${item.regimeType}"`,
            item.amount.toFixed(2).replace('.', ','),
            item.issRate.toFixed(2).replace('.', ','),
            item.issValue.toFixed(2).replace('.', ',')
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
            + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `fechamento_fiscal_cooperativa_${startDate}_a_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Fechamento Fiscal de Cooperativa"
            subtitle={`Resumo de atos cooperados e não cooperados • ${companyName}`}
            icon={Building2}
        >
            <div className="space-y-6 py-2">
                {/* Filtro por Período */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-violet-600 dark:text-violet-400" />
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Período de Apuração:</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                        <span className="text-xs text-gray-400 font-bold">até</span>
                        <div>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Ato Cooperado */}
                    <div className="p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Ato Cooperado (`4`)</span>
                            <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-2xl font-black text-emerald-950 dark:text-emerald-200">
                            {formatCurrency(reportData.totalAtoCooperadoVal)}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-emerald-700/80 dark:text-emerald-400/80 pt-1 border-t border-emerald-100 dark:border-emerald-900/30 font-medium">
                            <span>{reportData.countAtoCooperado} nota(s) emitida(s)</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-300">ISS / PIS: ISENTO (R$ 0,00)</span>
                        </div>
                    </div>

                    {/* Taxa Administrativa (Ato Não Cooperado) */}
                    <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Taxa Adm (`0`)</span>
                            <TrendingUp size={16} className="text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-2xl font-black text-amber-950 dark:text-amber-200">
                            {formatCurrency(reportData.totalTaxaAdmVal)}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-amber-700/80 dark:text-amber-400/80 pt-1 border-t border-amber-100 dark:border-amber-900/30 font-medium">
                            <span>{reportData.countTaxaAdm} nota(s) emitida(s)</span>
                            <span className="font-bold text-amber-600 dark:text-amber-300">ISS Est: {formatCurrency(reportData.totalIssTaxaAdm)}</span>
                        </div>
                    </div>

                    {/* Volume Total */}
                    <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">Volume Geral</span>
                            <Layers size={16} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <p className="text-2xl font-black text-indigo-950 dark:text-indigo-200">
                            {formatCurrency(reportData.totalGrossVolume)}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-indigo-700/80 dark:text-indigo-400/80 pt-1 border-t border-indigo-100 dark:border-indigo-900/30 font-medium">
                            <span>{reportData.totalInvoices} nota(s) no total</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-300">Pronto p/ Contabilidade</span>
                        </div>
                    </div>
                </div>

                {/* Tabela de Detalhamento */}
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">
                        Detalhamento Fiscal das Notas ({reportData.detailedList.length})
                    </h4>
                    <div className="border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-400 uppercase font-mono text-[9px] sticky top-0">
                                <tr>
                                    <th className="p-3">Data</th>
                                    <th className="p-3">Nº Nota / DPS</th>
                                    <th className="p-3">Tomador / Cliente</th>
                                    <th className="p-3">Tipo de Ato</th>
                                    <th className="p-3 text-right">Valor Bruto</th>
                                    <th className="p-3 text-right">ISS (%)</th>
                                    <th className="p-3 text-right">Valor ISS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50 font-medium text-gray-800 dark:text-gray-200">
                                {reportData.detailedList.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-6 text-center text-gray-400 font-normal">
                                            Nenhuma nota fiscal encontrada no período selecionado.
                                        </td>
                                    </tr>
                                ) : (
                                    reportData.detailedList.map((item, idx) => (
                                        <tr key={item.id || idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="p-3 font-mono">{item.date}</td>
                                            <td className="p-3 font-mono font-bold text-violet-600 dark:text-violet-400">{item.number}</td>
                                            <td className="p-3 max-w-[180px] truncate">{item.contact}</td>
                                            <td className="p-3">
                                                {item.isAtoCooperado ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-900/30">
                                                        <ShieldCheck size={10} /> Ato Cooperado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-900/30">
                                                        <TrendingUp size={10} /> Taxa Adm (`0`)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right font-bold">{formatCurrency(item.amount)}</td>
                                            <td className="p-3 text-right font-mono">{item.issRate.toFixed(2)}%</td>
                                            <td className={`p-3 text-right font-bold ${item.issValue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {formatCurrency(item.issValue)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <Button type="button" variant="outline" onClick={onClose} className="px-6">
                        Fechar
                    </Button>
                    <Button type="button" variant="outline" onClick={handleExportCSV} className="px-6 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold">
                        <Download size={14} className="mr-2" /> Exportar CSV Contábil
                    </Button>
                    <Button type="button" onClick={handlePrint} className="bg-violet-600 hover:bg-violet-700 text-white px-6 font-bold">
                        <Printer size={14} className="mr-2" /> Imprimir Relatório
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
