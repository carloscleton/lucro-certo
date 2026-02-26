import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CashFlowForecastProps {
    currentBalance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    pendingReceivable: number;
    pendingPayable: number;
}

export function CashFlowForecast({ currentBalance, monthlyIncome, monthlyExpense, pendingReceivable, pendingPayable }: CashFlowForecastProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // Project 3 months based on average income/expense
    const today = new Date();
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const projections = [];
    let runningBalance = currentBalance + pendingReceivable - pendingPayable; // Start with current + pending

    // Current month (actual)
    projections.push({
        name: months[today.getMonth()],
        balance: currentBalance,
        type: 'real',
    });

    // Next 3 months (projected)
    for (let i = 1; i <= 3; i++) {
        const futureMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const netFlow = monthlyIncome - monthlyExpense;
        runningBalance += netFlow;

        projections.push({
            name: months[futureMonth.getMonth()],
            balance: Math.round(runningBalance * 100) / 100,
            type: 'projetado',
        });
    }

    const minBalance = Math.min(...projections.map(p => p.balance));
    const willGoNegative = minBalance < 0;

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 shadow-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">{d.name} ({d.type})</p>
                <p className={`text-sm font-bold ${d.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(d.balance)}
                </p>
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Previsão de Fluxo</h3>
                </div>
                {willGoNegative && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-full">
                        <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
                        <span className="text-xs font-semibold text-red-700 dark:text-red-300">Saldo negativo previsto</span>
                    </div>
                )}
            </div>

            <div className="relative min-h-[200px] min-w-0 overflow-hidden">
                {isMounted && (
                    <div className="absolute inset-0 w-full h-full" style={{ minHeight: '1px', minWidth: '1px' }}>
                        <ResponsiveContainer key="chart-forecast" width="99%" height="100%" minWidth={1} minHeight={1} debounce={200}>
                            <LineChart data={projections} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                />
                                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5} />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="balance"
                                    stroke="#3b82f6"
                                    strokeWidth={2.5}
                                    dot={{ r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {!isMounted && (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="animate-pulse text-gray-400">Carregando gráfico...</div>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-blue-500 rounded" />
                    <span>Saldo projetado</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-red-500 rounded" style={{ borderTop: '1px dashed #ef4444' }} />
                    <span>Linha zero</span>
                </div>
            </div>
        </div>
    );
}
