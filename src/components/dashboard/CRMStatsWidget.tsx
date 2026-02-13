import { Target, BarChart3 } from 'lucide-react';
import { useCRM } from '../../hooks/useCRM';

interface CRMStatsWidgetProps {
    receivedIncome: number;
}

export function CRMStatsWidget({ receivedIncome }: CRMStatsWidgetProps) {
    const { deals, loading } = useCRM();

    if (loading) return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 animate-pulse h-[300px]">
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
            <div className="h-32 bg-gray-100 dark:bg-slate-700/50 rounded mb-4"></div>
        </div>
    );

    const activeDeals = deals.filter(d => d.status === 'active');
    const pipelineValue = activeDeals.reduce((sum, deal) => sum + deal.value, 0);

    // Calculate potential conversion if we have at least one deal
    const avgProbability = activeDeals.length > 0
        ? activeDeals.reduce((sum, deal) => sum + deal.probability, 0) / activeDeals.length
        : 0;

    const weightedPipeline = activeDeals.reduce((sum, deal) => sum + (deal.value * (deal.probability / 100)), 0);

    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Dashboard 360°</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Vendas (Expectativa) vs. Financeiro (Realidade)</p>
                </div>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                    <BarChart3 size={20} />
                </div>
            </div>

            <div className="space-y-4">
                {/* Pipeline Value */}
                <div className="relative overflow-hidden p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3 mb-1">
                        <Target size={16} className="text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pipeline Ativo</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(pipelineValue)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Soma de {activeDeals.length} negócios em andamento</p>
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Target size={48} />
                    </div>
                </div>

                {/* Comparison Card */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/10">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Recebido (Real)</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(receivedIncome)}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Ponderado (Previsto)</span>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(weightedPipeline)}</p>
                    </div>
                </div>

                {/* Performance Indicator */}
                <div className="pt-2">
                    <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">Probabilidade Média de Fechamento</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">{Math.round(avgProbability)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${avgProbability}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
