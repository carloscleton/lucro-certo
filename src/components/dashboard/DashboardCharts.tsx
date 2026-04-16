import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import type { ChartData } from '../../hooks/useDashboard';
import { useMemo, useState, useEffect } from 'react';

// Aggregate daily data into weeks for better visualization
function aggregateByWeek(data: ChartData[]): { name: string; income: number; expense: number; balance: number }[] {
    if (data.length === 0) return [];

    // If data represents roughly a month or less (<= 31 days), show daily resolution
    if (data.length <= 31) {
        return data.map(d => ({
            ...d,
            balance: d.income - d.expense
        }));
    }

    const weeks: { name: string; income: number; expense: number }[] = [];
    let weekIncome = 0;
    let weekExpense = 0;
    let weekStart = '';

    data.forEach((day, i) => {
        if (i % 7 === 0) {
            if (i > 0) {
                weeks.push({ name: weekStart, income: weekIncome, expense: weekExpense });
            }
            weekIncome = 0;
            weekExpense = 0;
            weekStart = day.name;
        }
        weekIncome += day.income;
        weekExpense += day.expense;
    });

    // Push last week
    if (weekStart) {
        weeks.push({ name: weekStart, income: weekIncome, expense: weekExpense });
    }

    return weeks.map(w => ({
        ...w,
        balance: w.income - w.expense,
    }));
}

import { formatDateString } from '../../utils/dateUtils';

const formatCurrency = (value: number) =>
    new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(value);

const CustomTooltip = ({ active, payload, label, isDaily }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;
    const income = data.income || 0;
    const expense = data.expense || 0;
    const balance = income - expense;
    const details = data.details || [];

    return (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 shadow-xl min-w-[220px] max-w-[300px]">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                {isDaily ? `Dia ${label}` : `Semana de ${label}`}
            </p>
            
            <div className="space-y-3">
                {/* Metrics Summary */}
                <div className="space-y-1.5 pb-2 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-xs text-gray-600 dark:text-gray-300">Receitas</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(income)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="text-xs text-gray-600 dark:text-gray-300">Despesas</span>
                        </div>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(expense)}
                        </span>
                    </div>
                </div>

                {/* Transaction Details (Specific Dates) */}
                {details.length > 0 && (
                    <div className="space-y-2">
                        {details.map((t: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 dark:bg-slate-900/40 p-2 rounded-lg border border-gray-100 dark:border-slate-700/50">
                                <p className="text-[10px] font-bold text-gray-700 dark:text-gray-200 truncate mb-1">
                                    {t.description}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-[9px] text-gray-500 dark:text-gray-400">
                                    <div>
                                        <span className="block opacity-60 uppercase">Vencimento</span>
                                        <span className="font-medium">{formatDateString(t.dueDate)}</span>
                                    </div>
                                    {(t.status === 'paid' || t.status === 'received') && (
                                        <div>
                                            <span className="block opacity-60 uppercase">Pagamento</span>
                                            <span className="font-medium text-blue-600 dark:text-blue-400">{formatDateString(t.paymentDate)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Final Balance */}
                <div className="pt-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Saldo do Dia</span>
                    <span className={`text-xs font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(balance)}
                    </span>
                </div>
            </div>
        </div>
    );
};

const CustomLegend = () => (
    <div className="flex items-center justify-center gap-6 pt-2">
        <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }} />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Receitas</span>
        </div>
        <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #ef4444, #f87171)' }} />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Despesas</span>
        </div>
    </div>
);

export function DashboardCharts({ data }: { data: ChartData[] }) {
    const weeklyData = useMemo(() => aggregateByWeek(data), [data]);
    const isDaily = data.length <= 31;
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 500);
        return () => clearTimeout(timer);
    }, []);

    if (weeklyData.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-[400px] flex items-center justify-center transition-colors">
                <p className="text-gray-400 dark:text-gray-500">Nenhum dado para o período selecionado</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-[400px] flex flex-col transition-colors">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Fluxo de Caixa</h3>
            <div className="flex-1 w-full relative min-h-[300px] min-w-0 overflow-hidden">
                {isMounted && (
                    <div className="absolute inset-0 w-full h-full flex flex-col" style={{ minHeight: '1px', minWidth: '1px' }}>
                        <ResponsiveContainer key="chart-fluxo" width="100%" height="100%" minHeight={0} debounce={50}>
                            <BarChart
                                data={weeklyData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                                barGap={isDaily ? 2 : 4}
                            >
                                <defs>
                                    <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.7} />
                                    </linearGradient>
                                    <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#f87171" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="currentColor"
                                    className="text-gray-100 dark:text-slate-700"
                                />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    dy={8}
                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                    interval={isDaily ? 'preserveStartEnd' : 0}
                                    minTickGap={isDaily ? 10 : 0}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                                    width={45}
                                />
                                <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
                                <Tooltip
                                    content={<CustomTooltip isDaily={isDaily} />}
                                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                />
                                <Legend content={<CustomLegend />} />
                                <Bar
                                    dataKey="income"
                                    name="Receitas"
                                    fill="url(#incomeGradient)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={isDaily ? 16 : 48}
                                />
                                <Bar
                                    dataKey="expense"
                                    name="Despesas"
                                    fill="url(#expenseGradient)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={isDaily ? 16 : 48}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {!isMounted && (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="animate-pulse text-gray-400">Carregando gráfico...</div>
                    </div>
                )}
            </div>
        </div>
    );
}
