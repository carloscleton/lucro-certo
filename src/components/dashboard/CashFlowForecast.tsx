import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { SafeChartContainer } from './SafeChartContainer';
import { useTranslation } from 'react-i18next';

interface CashFlowForecastProps {
    currentBalance: number;
    monthlyIncome: number;
    monthlyExpense: number;
    pendingReceivable: number;
    pendingPayable: number;
}

export function CashFlowForecast({ currentBalance, monthlyIncome, monthlyExpense, pendingReceivable, pendingPayable }: CashFlowForecastProps) {
    const { t } = useTranslation();

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(value);

    // Project 3 months based on average income/expense
    const today = new Date();
    const monthNames = t('dashboard.month_names', { returnObjects: true }) as string[];
    const months = Array.isArray(monthNames) ? monthNames.map(m => m.substring(0, 3)) : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const projections = [];
    let runningBalance = currentBalance + pendingReceivable - pendingPayable; // Start with current + pending

    // Current month (actual)
    projections.push({
        name: months[today.getMonth()],
        balance: currentBalance,
        type: t('dashboard.forecast_real'),
    });

    // Next 3 months (projected)
    for (let i = 1; i <= 3; i++) {
        const futureMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const netFlow = monthlyIncome - monthlyExpense;
        runningBalance += netFlow;

        projections.push({
            name: months[futureMonth.getMonth()],
            balance: Math.round(runningBalance * 100) / 100,
            type: t('dashboard.forecast_projected'),
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
        <div className="glass-card p-6 rounded-2xl transition-all hover:shadow-2xl hover:translate-y-[-2px] duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TrendingUp size={20} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest">{t('dashboard.forecast_title')}</h3>
                </div>
                {willGoNegative && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-full">
                        <AlertTriangle size={14} className="text-rose-600 dark:text-rose-400" />
                        <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-tighter">{t('dashboard.cash_risk')}</span>
                    </div>
                )}
            </div>

            <div className="h-[250px] w-full min-w-0">
                <SafeChartContainer className="w-full h-full relative">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={projections} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} 
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                                tickFormatter={(v) => `${window.__CURRENCY_CODE__ || 'BRL'} ${(v / 1000).toFixed(0)}k`}
                            />
                            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="3 3" strokeWidth={1} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }} />
                            <Line
                                type="monotone"
                                dataKey="balance"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
                                animationDuration={1500}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </SafeChartContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800/50 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    <span>{t('dashboard.projected_balance')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full border border-rose-500" />
                    <span>{t('dashboard.zero_line')}</span>
                </div>
            </div>
        </div>
    );
}
