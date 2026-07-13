import { useState } from 'react';
import { ChevronDown, ChevronUp, Award, Calendar, FileText, Layers, TrendingUp, DollarSign } from 'lucide-react';
import { clsx } from 'clsx';

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

    const cycleStartDay = typeof billingConfig.billing_cycle_start_day === 'number'
        ? billingConfig.billing_cycle_start_day
        : 1;

    // Helper to calculate cycle start and end dates
    const getBillingCycleDates = (day: number) => {
        const today = new Date();
        let cycleStart = new Date(today.getFullYear(), today.getMonth(), day, 0, 0, 0, 0);
        let cycleEnd = new Date(today.getFullYear(), today.getMonth() + 1, day, 0, 0, 0, 0);

        if (today.getDate() < day) {
            cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, day, 0, 0, 0, 0);
            cycleEnd = new Date(today.getFullYear(), today.getMonth(), day, 0, 0, 0, 0);
        }
        return { cycleStart, cycleEnd };
    };

    const { cycleStart, cycleEnd } = getBillingCycleDates(cycleStartDay);

    // Filter invoices of the current cycle
    const currentMonthInvoices = invoices.filter(inv => {
        if (!inv.created_at) return false;
        const d = new Date(inv.created_at);
        return d >= cycleStart && d < cycleEnd;
    });

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

    // Identify all providers with activity in this cycle, plus the active provider
    const providers = new Set<string>();
    providers.add(activeProvider);
    currentMonthInvoices.forEach(inv => {
        const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
        providers.add(p);
    });

    const providersDetails: any[] = [];
    let totalNotesAllProviders = 0;
    let totalCostAllProviders = 0;

    Array.from(providers).forEach(provider => {
        const isActive = provider === activeProvider;
        const providerInvoices = currentMonthInvoices.filter(inv => {
            const p = inv.type?.toLowerCase() === 'nfeio' ? 'nfeio' : 'tecnospeed';
            return p === provider;
        });

        const countActive = providerInvoices.filter(inv => 
            ['concluido', 'autorizada', 'concluído', 'autorizado'].includes(String(inv.status).toLowerCase())
        ).length;

        const countCanceled = providerInvoices.filter(inv => 
            ['cancelado', 'cancelada'].includes(String(inv.status).toLowerCase())
        ).length;

        const totalNotes = countActive + countCanceled;

        // Skip provider if not active and has no notes in the current cycle
        if (!isActive && totalNotes === 0) {
            return;
        }

        totalNotesAllProviders += totalNotes;

        let fixedFeeToApply = 0;
        let notesCost = 0;
        let appliedPerNoteFee = 0.50;
        const tieredBreakdown: any[] = [];

        if (fixedEnabled) {
            const providerConfig = billingConfig[provider] || {};
            if (isActive) {
                const fixedFee = typeof providerConfig.fixed_fee === 'number' ? providerConfig.fixed_fee : 30.00;
                fixedFeeToApply = fixedFee;
            }
            appliedPerNoteFee = typeof providerConfig.per_note_fee === 'number' ? providerConfig.per_note_fee : 0.50;
            notesCost = totalNotes * appliedPerNoteFee;
        } else if (tieredEnabled) {
            if (isActive) {
                const tieredFixedFee = typeof billingConfig.tiered_fixed_fee === 'number' ? billingConfig.tiered_fixed_fee : 100.00;
                fixedFeeToApply = tieredFixedFee;
            }
            // Compute tiered cost
            billingTiers.forEach(t => {
                const tierFrom = Number(t.from);
                const tierTo = Number(t.to || 999999);
                const price = Number(t.price);
                const notesInTier = Math.max(0, Math.min(totalNotes, tierTo) - tierFrom + 1);
                if (notesInTier > 0) {
                    const cost = notesInTier * price;
                    notesCost += cost;
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

        const providerTotal = fixedFeeToApply + notesCost;
        totalCostAllProviders += providerTotal;

        providersDetails.push({
            provider,
            isActive,
            notesCount: countActive,
            canceledCount: countCanceled,
            totalNotes,
            fixedFeeToApply,
            appliedPerNoteFee,
            notesCost,
            providerTotal,
            tieredBreakdown
        });
    });

    const activeProviderDetails = providersDetails.find(pd => pd.isActive) || providersDetails[0];
    const activeProviderTotalNotes = activeProviderDetails?.totalNotes || 0;

    // Find current tier (based on active provider's usage)
    const currentTier = tieredEnabled 
        ? billingTiers.find(t => activeProviderTotalNotes >= Number(t.from) && activeProviderTotalNotes <= Number(t.to)) || billingTiers[0]
        : null;

    // Find next tier
    const nextTier = tieredEnabled
        ? billingTiers.find(t => Number(t.from) > activeProviderTotalNotes)
        : null;

    const currentPrice = currentTier ? Number(currentTier.price) : (activeProviderDetails?.appliedPerNoteFee ?? 0.50);
    const nextPrice = nextTier ? Number(nextTier.price) : null;
    const notesToNextTier = nextTier ? Number(nextTier.from) - activeProviderTotalNotes : 0;

    const currentTierLimit = currentTier ? Number(currentTier.to) : 100;
    const currentTierStart = currentTier ? Number(currentTier.from) : 1;
    const progressInCurrentTier = currentTier
        ? Math.min(100, Math.max(0, ((activeProviderTotalNotes - currentTierStart + 1) / (currentTierLimit - currentTierStart + 1)) * 100))
        : 100;

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const getSummaryText = () => {
        const cycleText = `no ciclo de ${cycleStart.toLocaleDateString('pt-BR')} a ${cycleEnd.toLocaleDateString('pt-BR')}`;
        
        if (providersDetails.length <= 1) {
            const pd = providersDetails[0] || { totalNotes: 0 };
            return (
                <>
                    Você emitiu <strong className="text-gray-900 dark:text-white">{pd.totalNotes} nota{pd.totalNotes !== 1 ? 's' : ''}</strong> {cycleText}.
                </>
            );
        }
        
        const parts = providersDetails.map(pd => {
            const providerName = pd.provider === 'nfeio' ? 'NFe.io' : (pd.provider === 'tecnospeed' ? 'TecnoSpeed' : pd.provider);
            const activeSuffix = pd.isActive ? '' : ' (Inativo)';
            return `${pd.totalNotes} via ${providerName}${activeSuffix}`;
        });
        
        return (
            <>
                Você emitiu <strong className="text-gray-900 dark:text-white">{totalNotesAllProviders} notas</strong> {cycleText} ({parts.join(' e ')}).
            </>
        );
    };

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
                            {getSummaryText()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-white dark:bg-slate-900/40 p-3 rounded-2xl border border-gray-100 dark:border-slate-800 self-stretch md:self-auto justify-between md:justify-start">
                    <div className="text-right">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold block">Valor Estimado</span>
                        <span className="text-lg font-black text-blue-600 dark:text-blue-400">{fmt(totalCostAllProviders)}</span>
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
                <div className="mt-5 pt-5 border-t border-gray-150 dark:border-slate-800 space-y-4 animate-in slide-in-from-top-4 duration-350">
                    <div className={clsx(
                        "grid gap-5",
                        tieredEnabled ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
                    )}>
                        {/* Summary of applied billing */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                            <div>
                                <h5 className="font-bold text-xs uppercase text-gray-400 dark:text-slate-500 tracking-wider mb-4 flex items-center gap-1.5">
                                    <TrendingUp size={14} className="text-blue-500" />
                                    Demonstrativo Detalhado
                                </h5>
                                
                                <div className="space-y-4">
                                    {providersDetails.map((pd, index) => {
                                        const providerName = pd.provider === 'nfeio' ? 'NFe.io' : (pd.provider === 'tecnospeed' ? 'TecnoSpeed' : pd.provider);
                                        return (
                                            <div 
                                                key={pd.provider} 
                                                className="p-4 rounded-xl bg-gray-50/50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]"
                                            >
                                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2 mb-3">
                                                    <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-350">
                                                        {providerName}
                                                    </span>
                                                    <span className={clsx(
                                                        "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                                        pd.isActive 
                                                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                            : "bg-gray-100 dark:bg-slate-800 text-gray-400 border-gray-200/50 dark:border-slate-750"
                                                    )}>
                                                        {pd.isActive ? 'Ativo' : 'Histórico (Inativo)'}
                                                    </span>
                                                </div>

                                                <div className="space-y-2.5">
                                                    {fixedEnabled && pd.fixedFeeToApply > 0 && (
                                                        <div className="flex justify-between items-center py-1 text-xs">
                                                            <div className="flex items-center gap-2 text-gray-500 font-medium">
                                                                <Calendar size={13} className="text-gray-400" />
                                                                <span>Mensalidade Fixa Módulo Fiscal:</span>
                                                            </div>
                                                            <span className="font-semibold text-gray-800 dark:text-slate-200">{fmt(pd.fixedFeeToApply)}</span>
                                                        </div>
                                                    )}

                                                    {tieredEnabled && pd.fixedFeeToApply > 0 && (
                                                        <div className="flex justify-between items-center py-1 text-xs">
                                                            <div className="flex items-center gap-2 text-gray-500 font-medium">
                                                                <Calendar size={13} className="text-gray-400" />
                                                                <span>Mensalidade Fixa Módulo Fiscal (Faixas):</span>
                                                            </div>
                                                            <span className="font-semibold text-gray-800 dark:text-slate-200">{fmt(pd.fixedFeeToApply)}</span>
                                                        </div>
                                                    )}

                                                    {tieredEnabled ? (
                                                        <div className="space-y-2 py-1 border-t border-gray-50 dark:border-slate-850/50 pt-2 mt-1">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-550 block">Notas Cobradas por Faixas:</span>
                                                            {pd.tieredBreakdown.map((b: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-center pl-3 text-xs">
                                                                    <div className="flex items-center gap-2 text-gray-500">
                                                                        <Layers size={11} className="text-gray-400" />
                                                                        <span>{b.count} nota{b.count !== 1 ? 's' : ''} em Faixa {b.from}-{b.to >= 999999 ? '∞' : b.to} ({fmt(b.price)}/nota)</span>
                                                                    </div>
                                                                    <span className="font-medium text-gray-700 dark:text-slate-350">{fmt(b.cost)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-between items-center py-1 text-xs">
                                                            <div className="flex items-center gap-2 text-gray-500 font-medium">
                                                                <FileText size={13} className="text-gray-400" />
                                                                <span>Notas Emitidas ({pd.totalNotes} x {fmt(pd.appliedPerNoteFee)}/nota):</span>
                                                            </div>
                                                            <span className="font-semibold text-gray-800 dark:text-slate-200">{fmt(pd.notesCost)}</span>
                                                        </div>
                                                    )}

                                                    <div className="flex justify-between items-center pt-2.5 border-t border-gray-100 dark:border-slate-800/80 mt-1">
                                                        <span className="text-[10px] uppercase font-bold text-gray-450 tracking-wider">Subtotal {providerName}</span>
                                                        <span className="font-bold text-xs text-gray-900 dark:text-white">{fmt(pd.providerTotal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Highlighted Grand Total Card */}
                            <div className="mt-5 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-500/20 dark:border-blue-900/35 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500 text-white rounded-lg shadow-md shadow-blue-500/10">
                                        <DollarSign size={16} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-black block leading-none">Total Estimado Geral</span>
                                        <span className="text-[11px] text-gray-500 font-medium block mt-1">Soma de todos os emissores no ciclo</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black text-blue-600 dark:text-blue-450 leading-none">{fmt(totalCostAllProviders)}</span>
                            </div>
                        </div>

                        {/* Complete Tiers Table */}
                        {tieredEnabled && (
                            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800/80 shadow-sm">
                                <h5 className="font-bold text-xs uppercase text-gray-400 dark:text-slate-500 tracking-wider mb-4 flex items-center gap-1.5">
                                    <Layers size={14} className="text-blue-500" />
                                    Tabela de Faixas Ativas
                                </h5>
                                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800 text-xs">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 dark:bg-slate-800 font-bold text-[10px] text-gray-550 uppercase tracking-wider">
                                            <tr>
                                                <th className="p-3">Faixa (Qtd/Mês)</th>
                                                <th className="p-3 text-right">Preço por Nota</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-slate-850">
                                            {sortedTiers.map((t, idx) => {
                                                const isCurrent = currentTier && Number(currentTier.from) === Number(t.from);
                                                return (
                                                    <tr key={idx} className={isCurrent ? "bg-blue-50/40 dark:bg-blue-950/20 font-bold text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}>
                                                        <td className="p-3 flex items-center gap-2">
                                                            <span>{t.from} a {t.to >= 999999 ? 'Acima' : t.to} notas</span>
                                                            {isCurrent && (
                                                                <span className="text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                                    Atual
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right font-mono font-semibold">{fmt(Number(t.price))}</td>
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
