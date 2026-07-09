import { useState } from 'react';
import { ChevronDown, ChevronUp, Award } from 'lucide-react';

interface PlatformBillingTrackerProps {
    invoices: any[];
    companySettings: any;
    activeProvider: string;
}

export function PlatformBillingTracker({ invoices, companySettings, activeProvider }: PlatformBillingTrackerProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const billingConfig = companySettings?.admin_fiscal_billing || {};
    const fixedEnabled = billingConfig.fixed_enabled ?? true;
    const tieredEnabled = !!billingConfig.tiered_enabled;
    const tiers = billingConfig.tiers || [];

    // Filter invoices of the current month (Calendar month)
    const now = new Date();
    const currentMonthInvoices = invoices.filter(inv => {
        if (!inv.created_at) return false;
        const d = new Date(inv.created_at);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    // Provider check
    const currentProviderInvoices = currentMonthInvoices.filter(inv => {
        const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
        return p === activeProvider;
    });

    const countActive = currentProviderInvoices.filter(inv => 
        ['concluido', 'autorizada', 'concluído', 'autorizado'].includes(String(inv.status).toLowerCase())
    ).length;

    const countCanceled = currentProviderInvoices.filter(inv => 
        ['cancelado', 'cancelada'].includes(String(inv.status).toLowerCase())
    ).length;

    const totalNotes = countActive + countCanceled;

    // If neither model is active, hide tracker
    if (!fixedEnabled && !tieredEnabled) {
        return null;
    }

    // Default tiers if tiered is enabled but list is empty (matching the user's table)
    const sortedTiers = tieredEnabled && tiers.length > 0 
        ? [...tiers].sort((a, b) => Number(a.from) - Number(b.from))
        : [
            { from: 1, to: 100, price: 0.85 },
            { from: 101, to: 200, price: 0.80 },
            { from: 201, to: 300, price: 0.75 },
            { from: 301, to: 400, price: 0.70 },
            { from: 401, to: 500, price: 0.65 },
            { from: 501, to: 600, price: 0.60 },
            { from: 601, to: 700, price: 0.55 },
            { from: 701, to: 800, price: 0.50 },
            { from: 801, to: 900, price: 0.45 },
            { from: 901, to: 999999, price: 0.40 }
        ];

    const contractedIdx = typeof billingConfig.contracted_tier_index === 'number'
        ? billingConfig.contracted_tier_index
        : 0;

    const billingTiers: any[] = [];
    if (sortedTiers.length > 0) {
        const contractedTier = sortedTiers[contractedIdx] || sortedTiers[0];
        billingTiers.push({
            from: 1,
            to: Number(contractedTier.to || 999999),
            price: Number(contractedTier.price)
        });

        for (let i = contractedIdx + 1; i < sortedTiers.length; i++) {
            billingTiers.push({
                from: Number(sortedTiers[i].from),
                to: Number(sortedTiers[i].to || 999999),
                price: Number(sortedTiers[i].price)
            });
        }
    }

    // Compute tiered breakdown and costs
    const tieredBreakdown: any[] = [];
    let tieredCost = 0;
    
    if (tieredEnabled) {
        billingTiers.forEach(t => {
            const tierFrom = Number(t.from);
            const tierTo = Number(t.to || 999999);
            const price = Number(t.price);
            const notesInTier = Math.max(0, Math.min(totalNotes, tierTo) - tierFrom + 1);
            if (notesInTier > 0) {
                const cost = notesInTier * price;
                tieredCost += cost;
                tieredBreakdown.push({
                    from: tierFrom,
                    to: tierTo,
                    price,
                    count: notesInTier,
                    cost
                });
            }
        });
    }

    // Calculate fixed + addon cost
    const providerConfig = billingConfig[activeProvider] || {};
    const fixedFee = typeof providerConfig.fixed_fee === 'number' ? providerConfig.fixed_fee : 30.00;
    const perNoteFee = typeof providerConfig.per_note_fee === 'number' ? providerConfig.per_note_fee : 0.50;

    const tieredFixedFee = typeof billingConfig.tiered_fixed_fee === 'number' ? billingConfig.tiered_fixed_fee : 100.00;
    const totalCostThisMonth = tieredEnabled
        ? (tieredFixedFee + tieredCost)
        : (fixedEnabled ? fixedFee + (totalNotes * perNoteFee) : 0);

    // Find current tier
    const currentTier = tieredEnabled 
        ? billingTiers.find(t => totalNotes >= Number(t.from) && totalNotes <= Number(t.to)) || billingTiers[0]
        : null;

    // Find next tier
    const nextTier = tieredEnabled
        ? billingTiers.find(t => Number(t.from) > totalNotes)
        : null;

    const currentPrice = currentTier ? Number(currentTier.price) : perNoteFee;
    const nextPrice = nextTier ? Number(nextTier.price) : null;
    const notesToNextTier = nextTier ? Number(nextTier.from) - totalNotes : 0;

    const currentTierLimit = currentTier ? Number(currentTier.to) : 100;
    const currentTierStart = currentTier ? Number(currentTier.from) : 1;
    const progressInCurrentTier = currentTier
        ? Math.min(100, Math.max(0, ((totalNotes - currentTierStart + 1) / (currentTierLimit - currentTierStart + 1)) * 100))
        : 100;

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    return (
        <div className="bg-gradient-to-r from-blue-50/40 via-indigo-50/10 to-transparent dark:from-slate-850 dark:via-slate-850/60 dark:to-transparent border border-blue-100/50 dark:border-slate-800 rounded-3xl p-5 mb-6 animate-in fade-in duration-300 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-start gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                        <Award size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                                Acompanhamento de Custos de Emissão
                            </h4>
                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full">
                                {activeProvider === 'tecnospeed' ? 'TecnoSpeed' : 'NFe.io'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Você emitiu <strong className="text-gray-900 dark:text-white">{totalNotes} nota{totalNotes !== 1 ? 's' : ''}</strong> neste mês de {now.toLocaleString('pt-BR', { month: 'long' })}.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white dark:bg-slate-900/40 p-3 rounded-2xl border border-gray-100 dark:border-slate-800 self-stretch md:self-auto justify-between md:justify-start">
                    <div className="text-right">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block">Valor Estimado</span>
                        <span className="text-lg font-black text-blue-600 dark:text-blue-400">{fmt(totalCostThisMonth)}</span>
                    </div>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                    >
                        <span className="text-xs font-bold hidden sm:inline">{isExpanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}</span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* Tiered Progress Section */}
            {tieredEnabled && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            Faixa Atual: <span className="text-blue-600 dark:text-blue-400 font-bold">{currentTier ? `${currentTier.from} a ${currentTier.to >= 999999 ? '∞' : currentTier.to} notas` : ''}</span> (Custo: <span className="font-bold text-gray-900 dark:text-white">{fmt(currentPrice)}/nota</span>)
                        </div>
                        {nextTier && (
                            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100/50 dark:border-emerald-900/20">
                                Faltam {notesToNextTier} nota{notesToNextTier !== 1 ? 's' : ''} para a faixa de {fmt(Number(nextPrice))}/nota!
                            </div>
                        )}
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
                        <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressInCurrentTier}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400 mt-1 font-semibold uppercase tracking-wider">
                        <span>Min: {currentTierStart}</span>
                        <span>Progresso na Faixa: {progressInCurrentTier.toFixed(0)}%</span>
                        <span>Max: {currentTierLimit >= 999999 ? '∞' : currentTierLimit}</span>
                    </div>
                </div>
            )}

            {/* Expanded Detailed Breakdown */}
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-4 duration-300">
                    {/* Tiers list & cost calculator */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Summary of applied billing */}
                        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/60">
                            <h5 className="font-bold text-xs uppercase text-gray-400 dark:text-slate-500 tracking-wider mb-3">Demonstrativo Detalhado</h5>
                            <div className="space-y-2 text-xs">
                                {fixedEnabled && (
                                    <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-800/40">
                                        <span className="text-gray-500 font-medium">Mensalidade Fixa Módulo Fiscal:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{fmt(fixedFee)}</span>
                                    </div>
                                )}

                                {tieredEnabled && (
                                    <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-800/40">
                                        <span className="text-gray-500 font-medium">Mensalidade Fixa Módulo Fiscal (Faixas):</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{fmt(tieredFixedFee)}</span>
                                    </div>
                                )}

                                {tieredEnabled ? (
                                    <div className="space-y-1.5 py-1">
                                        <span className="text-gray-500 font-bold block mb-1">Notas Cobradas por Faixas:</span>
                                        {tieredBreakdown.map((b, idx) => (
                                            <div key={idx} className="flex justify-between pl-3 text-[11px] text-gray-600 dark:text-gray-400">
                                                <span>• {b.count} nota{b.count !== 1 ? 's' : ''} em Faixa {b.from}-{b.to >= 999999 ? '∞' : b.to} ({fmt(b.price)}/nota)</span>
                                                <span className="font-medium">{fmt(b.cost)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex justify-between py-1 border-b border-gray-50 dark:border-slate-800/40">
                                        <span className="text-gray-500 font-medium">Notas Emitidas ({totalNotes} x {fmt(perNoteFee)}/nota):</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{fmt(totalNotes * perNoteFee)}</span>
                                    </div>
                                )}
                                
                                <div className="flex justify-between pt-3 border-t-2 border-dashed border-gray-100 dark:border-slate-800 font-bold text-sm text-gray-900 dark:text-white">
                                    <span>Total Estimado:</span>
                                    <span className="text-blue-600 dark:text-blue-400">{fmt(totalCostThisMonth)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Complete Tiers Table */}
                        {tieredEnabled && (
                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/60">
                                <h5 className="font-bold text-xs uppercase text-gray-400 dark:text-slate-500 tracking-wider mb-2">Tabela de Faixas Ativas</h5>
                                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800 text-xs">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-slate-800 font-bold text-[10px] text-gray-500 uppercase">
                                            <tr>
                                                <th className="p-2.5">Faixa (Qtd/Mês)</th>
                                                <th className="p-2.5 text-right">Preço por Nota</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-850">
                                            {sortedTiers.map((t, idx) => {
                                                const isCurrent = currentTier && Number(currentTier.from) === Number(t.from);
                                                return (
                                                    <tr key={idx} className={isCurrent ? "bg-blue-50/50 dark:bg-blue-950/20 font-bold text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}>
                                                        <td className="p-2.5">
                                                            {t.from} a {t.to >= 999999 ? 'Acima' : t.to} notas
                                                            {isCurrent && <span className="ml-2 text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Atual</span>}
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono">{fmt(Number(t.price))}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
