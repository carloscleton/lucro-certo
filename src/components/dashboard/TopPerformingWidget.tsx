import { Trophy, TrendingUp } from 'lucide-react';
import type { Category } from '../../hooks/useCategories';

interface TopPerformingWidgetProps {
    expensesByCategory: { category_id: string; amount: number }[];
    categories: Category[];
}

export function TopPerformingWidget({ expensesByCategory, categories }: TopPerformingWidgetProps) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(value);

    // Get top 3
    const topCategories = expensesByCategory.slice(0, 3).map((item, index) => {
        const category = categories.find(c => c.id === item.category_id);
        return {
            name: category?.name || 'Sem Categoria',
            amount: item.amount,
            rank: index + 1
        };
    });

    if (topCategories.length === 0) return null;

    return (
        <div className="glass-card p-6 rounded-2xl h-full flex flex-col transition-all hover:shadow-2xl hover:translate-y-[-2px] duration-300">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Trophy size={16} className="text-amber-500" />
                        Pódio de Despesas
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">As 3 maiores saídas por categoria</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-4">
                {topCategories.map((item) => (
                    <div key={item.rank} className="relative group">
                        <div className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                            item.rank === 1 
                            ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30' 
                            : 'bg-gray-50/50 dark:bg-slate-900/30 border-gray-100 dark:border-slate-800'
                        }`}>
                            {/* Rank Indicator */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                                item.rank === 1 ? 'bg-amber-500 text-white' : 
                                item.rank === 2 ? 'bg-slate-300 text-slate-700' : 
                                'bg-orange-300 text-orange-800'
                            }`}>
                                {item.rank}º
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                    {item.name}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                    Impacto Financeiro
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-sm font-black text-gray-900 dark:text-white">
                                    {formatCurrency(item.amount)}
                                </p>
                                <div className="flex items-center justify-end gap-0.5 text-[9px] font-bold text-red-500">
                                    <TrendingUp size={10} />
                                    ALTO
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-auto pt-6">
                <button className="w-full py-3 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 border border-blue-200/50 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 text-[11px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all duration-300 shadow-sm hover:shadow-blue-200 dark:hover:shadow-none">
                    Ver Relatório Completo
                </button>
            </div>
        </div>
    );
}
