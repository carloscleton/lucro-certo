import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Category } from '../../hooks/useCategories';
import { SafeChartContainer } from './SafeChartContainer';

interface ExpenseByCategoryChartProps {
    expenses: { category_id: string; amount: number }[];
    categories: Category[];
}

const COLORS = [
    '#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
    '#84cc16', '#a855f7', '#ef4444', '#22d3ee', '#eab308',
];

export function ExpenseByCategoryChart({ expenses, categories }: ExpenseByCategoryChartProps) {

    if (expenses.length === 0) return null;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(value);

    const total = expenses.reduce((acc, e) => acc + e.amount, 0);

    const data = expenses.slice(0, 10).map((e, i) => {
        const cat = categories.find(c => c.id === e.category_id);
        return {
            name: cat?.name || 'Sem categoria',
            value: e.amount,
            percentage: ((e.amount / total) * 100).toFixed(1),
            color: COLORS[i % COLORS.length],
        };
    });

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 shadow-lg">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{d.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {formatCurrency(d.value)} ({d.percentage}%)
                </p>
            </div>
        );
    };

    return (
        <div className="glass-card p-6 rounded-2xl transition-all hover:shadow-2xl hover:translate-y-[-2px] duration-300">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                        Distribuição de Despedas
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Visão proporcional por categoria no período</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-8">
                {/* Chart */}
                <div className="w-full lg:w-1/2 min-h-[240px] min-w-0 relative">
                    <SafeChartContainer className="w-full h-[240px]">
                        <ResponsiveContainer key="chart-cat" width="100%" height="100%" minHeight={1} debounce={50}>
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={95}
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.color} 
                                            className="hover:opacity-80 transition-opacity"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </SafeChartContainer>
                    {/* Central Total */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Total</span>
                        <span className="text-lg font-black text-gray-900 dark:text-white">{formatCurrency(total)}</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="w-full lg:w-1/2 space-y-2.5 max-h-[240px] overflow-y-auto custom-scrollbar pr-2">
                    {data.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-xl group hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-all border border-transparent hover:border-gray-100 dark:hover:border-slate-700/50">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: d.color }} />
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="text-xs font-black text-gray-900 dark:text-white">{formatCurrency(d.value)}</span>
                                <div className="w-10 text-right">
                                    <span className="text-[10px] font-black text-gray-400 group-hover:text-indigo-500 transition-colors">{d.percentage}%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
