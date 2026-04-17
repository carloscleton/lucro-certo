import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Category } from '../../hooks/useCategories';
import { useState, useEffect } from 'react';
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
    const [dataState, setDataState] = useState(expenses);
    
    useEffect(() => {
        setDataState(expenses);
    }, [expenses]);

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
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Despesas por Categoria</h3>
            <div className="flex flex-col lg:flex-row items-center gap-4">
                {/* Chart */}
                <div className="w-full lg:w-1/2 min-h-[220px] min-w-0">
                    <SafeChartContainer className="w-full h-full">
                        <ResponsiveContainer key="chart-cat" width="100%" height="100%" minHeight={1} debounce={50}>
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={90}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </SafeChartContainer>
                </div>
                {/* Legend */}
                <div className="w-full lg:w-1/2 space-y-2 max-h-[220px] overflow-y-auto">
                    {data.map((d, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs font-bold text-gray-900 dark:text-white">{formatCurrency(d.value)}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">{d.percentage}%</span>
                            </div>
                        </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-gray-100 dark:border-slate-700 px-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Total</span>
                            <span className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
