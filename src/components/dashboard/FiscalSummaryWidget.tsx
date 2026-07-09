import { BarChart3, Calculator, FileText, Landmark, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FiscalSummaryWidgetProps {
    invoices: any[];
    fiscalSettings: any;
    fiscalEnabled: boolean;
}

export function FiscalSummaryWidget({ invoices, fiscalSettings, fiscalEnabled }: FiscalSummaryWidgetProps) {
    const { t } = useTranslation();

    if (!fiscalEnabled || !invoices || invoices.length === 0) {
        return null;
    }

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

    const calculateTaxesSummary = () => {
        let totalFaturado = 0;
        let totalIss = 0;
        let totalPis = 0;
        let totalCofins = 0;
        let totalCsll = 0;
        let totalIr = 0;

        const cfgPis    = fiscalSettings?.default_pis_aliquota    ? Number(fiscalSettings.default_pis_aliquota)    : null;
        const cfgCofins = fiscalSettings?.default_cofins_aliquota ? Number(fiscalSettings.default_cofins_aliquota) : null;
        const cfgCsll   = fiscalSettings?.default_csll_aliquota   ? Number(fiscalSettings.default_csll_aliquota)   : null;
        const cfgIrrf   = fiscalSettings?.default_irrf_aliquota   ? Number(fiscalSettings.default_irrf_aliquota)   : null;
        const cfgIss    = fiscalSettings?.default_iss_aliquota    ? Number(fiscalSettings.default_iss_aliquota)    : null;

        const authorizedInvoices = invoices.filter(i => 
            ['concluido', 'autorizado'].includes(i.status?.toLowerCase())
        );

        authorizedInvoices.forEach(i => {
            const amount = getInvoiceAmount(i.payload);
            totalFaturado += amount;

            const p = i.payload || {};
            const servicos = Array.isArray(p.servico) ? p.servico : (p.servico ? [p.servico] : []);
            const serviceItem = servicos[0];
            
            const invoiceRegime = p.prestador?.regimeTributario !== undefined 
                ? String(p.prestador.regimeTributario)
                : (p.retorno?.prestador?.regimeTributario !== undefined 
                    ? String(p.retorno.prestador.regimeTributario)
                    : String(fiscalSettings?.regime_tributario || '1'));
            
            const isInvoiceSimples = ['1', '2', '4'].includes(invoiceRegime);
            
            let issRate: number;
            if (serviceItem?.iss?.aliquota !== undefined && serviceItem?.iss?.aliquota !== null && serviceItem?.iss?.aliquota !== '') {
                issRate = Number(serviceItem.iss.aliquota);
            } else if (p.issRate !== undefined && p.issRate !== null && p.issRate !== '') {
                const rawIss = Number(p.issRate);
                issRate = rawIss < 1 ? rawIss * 100 : rawIss;
            } else if (cfgIss !== null) {
                issRate = cfgIss;
            } else {
                issRate = 0;
            }
            totalIss += amount * (issRate / 100);

            let pisRate: number;
            if (isInvoiceSimples) {
                pisRate = 0;
            } else if (serviceItem?.pis?.aliquota !== undefined && serviceItem?.pis?.aliquota !== null && serviceItem?.pis?.aliquota !== '') {
                pisRate = Number(serviceItem.pis.aliquota);
            } else if (p.pisRate !== undefined && p.pisRate !== null && p.pisRate !== '') {
                const rawPis = Number(p.pisRate);
                pisRate = rawPis < 1 ? rawPis * 100 : rawPis;
            } else if (cfgPis !== null) {
                pisRate = cfgPis;
            } else {
                pisRate = 0;
            }
            totalPis += amount * (pisRate / 100);

            let cofinsRate: number;
            if (isInvoiceSimples) {
                cofinsRate = 0;
            } else if (serviceItem?.cofins?.aliquota !== undefined && serviceItem?.cofins?.aliquota !== null && serviceItem?.cofins?.aliquota !== '') {
                cofinsRate = Number(serviceItem.cofins.aliquota);
            } else if (p.cofinsRate !== undefined && p.cofinsRate !== null && p.cofinsRate !== '') {
                const rawCofins = Number(p.cofinsRate);
                cofinsRate = rawCofins < 1 ? rawCofins * 100 : rawCofins;
            } else if (cfgCofins !== null) {
                cofinsRate = cfgCofins;
            } else {
                cofinsRate = 0;
            }
            totalCofins += amount * (cofinsRate / 100);

            let csllRate: number;
            if (isInvoiceSimples) {
                csllRate = 0;
            } else if (serviceItem?.csll?.aliquota !== undefined && serviceItem?.csll?.aliquota !== null && serviceItem?.csll?.aliquota !== '') {
                csllRate = Number(serviceItem.csll.aliquota);
            } else if (p.csllRate !== undefined && p.csllRate !== null && p.csllRate !== '') {
                const rawCsll = Number(p.csllRate);
                csllRate = rawCsll < 1 ? rawCsll * 100 : rawCsll;
            } else if (cfgCsll !== null) {
                csllRate = cfgCsll;
            } else {
                csllRate = 0;
            }
            totalCsll += amount * (csllRate / 100);

            let irRate: number;
            if (isInvoiceSimples) {
                irRate = 0;
            } else if (serviceItem?.ir?.aliquota !== undefined && serviceItem?.ir?.aliquota !== null && serviceItem?.ir?.aliquota !== '') {
                irRate = Number(serviceItem.ir.aliquota);
            } else if (p.irRate !== undefined && p.irRate !== null && p.irRate !== '') {
                const rawIr = Number(p.irRate);
                irRate = rawIr < 1 ? rawIr * 100 : rawIr;
            } else if (cfgIrrf !== null) {
                irRate = cfgIrrf;
            } else {
                irRate = 0;
            }
            totalIr += amount * (irRate / 100);
        });

        const totalRetenções = totalPis + totalCofins + totalCsll + totalIr;
        const totalImpostos = totalIss + totalRetenções;

        return {
            authorizedCount: authorizedInvoices.length,
            totalCount: invoices.length,
            totalFaturado,
            totalIss,
            totalRetenções,
            totalImpostos,
            netAmount: totalFaturado - totalImpostos
        };
    };

    const summary = calculateTaxesSummary();
    const fmt = (v: number) => new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(v);
    const pct = (v: number) => summary.totalFaturado > 0 ? ((v / summary.totalFaturado) * 100).toFixed(2) : '0.00';

    return (
        <div className="bg-gradient-to-br from-indigo-50/15 via-white to-purple-50/10 dark:from-slate-900 dark:to-slate-900/60 p-6 rounded-2xl border border-indigo-100/30 dark:border-slate-800 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <BarChart3 size={18} className="text-indigo-500" />
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">
                        Resumo Fiscal do Período
                    </h3>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-full border border-indigo-100/50 dark:border-indigo-900/40">
                    <FileText size={13} />
                    <span>{summary.totalCount} nota{summary.totalCount !== 1 ? 's' : ''} no período</span>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Faturado */}
                <div className="bg-white/60 dark:bg-slate-950/20 p-4 rounded-xl border border-indigo-50/30 dark:border-slate-800/40 flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Total Faturado</span>
                        <span className="text-xl font-black text-gray-950 dark:text-white">{fmt(summary.totalFaturado)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold mt-3">
                        <ShieldCheck size={12} />
                        <span>{summary.authorizedCount} autorizada{summary.authorizedCount !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                {/* ISS Calculado */}
                <div className="bg-white/60 dark:bg-slate-950/20 p-4 rounded-xl border border-indigo-50/30 dark:border-slate-800/40 flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest block mb-1">ISS Calculado (Est.)</span>
                        <span className="text-xl font-black text-blue-600 dark:text-blue-400">{fmt(summary.totalIss)}</span>
                    </div>
                    {summary.totalFaturado > 0 && (
                        <span className="text-[10px] text-blue-400 dark:text-blue-500 font-bold block mt-3">
                            {pct(summary.totalIss)}% do faturado
                        </span>
                    )}
                </div>

                {/* Retenções Federais */}
                <div className="bg-white/60 dark:bg-slate-950/20 p-4 rounded-xl border border-indigo-50/30 dark:border-slate-800/40 flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Retenções Federais</span>
                        <span className="text-xl font-black text-amber-600 dark:text-amber-500">{fmt(summary.totalRetenções)}</span>
                    </div>
                    {summary.totalFaturado > 0 && (
                        <span className="text-[10px] text-amber-500 dark:text-amber-500 font-bold block mt-3">
                            {pct(summary.totalRetenções)}% do faturado
                        </span>
                    )}
                </div>

                {/* Líquido Recebido Estimado */}
                <div className="bg-gradient-to-br from-emerald-50/40 to-emerald-50/10 dark:from-emerald-950/10 dark:to-emerald-950/5 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between col-span-2 lg:col-span-2">
                    <div>
                        <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Líquido Recebido (Est.)</span>
                        <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{fmt(summary.netAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                        <span className="text-[10px] text-emerald-500 font-bold">
                            {pct(summary.netAmount)}% do faturado
                        </span>
                        <Calculator size={14} className="text-emerald-500/60" />
                    </div>
                </div>
            </div>
        </div>
    );
}
