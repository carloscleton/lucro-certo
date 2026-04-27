import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { SafeChartContainer } from './SafeChartContainer';

interface GaugeProps {
    value: number; // 0 to 100
    label: string;
    description?: string;
    color?: string;
}

function Gauge({ value, label, description, color = '#10b981' }: GaugeProps) {
    const data = [
        { value: value },
        { value: 100 - value },
    ];

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="relative w-full h-[140px]">
                <SafeChartContainer className="w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="85%"
                                startAngle={180}
                                endAngle={0}
                                innerRadius={60}
                                outerRadius={85}
                                paddingAngle={0}
                                dataKey="value"
                                stroke="none"
                            >
                                <Cell key="value" fill={color} />
                                <Cell key="remaining" fill="#f1f5f9" className="dark:fill-slate-700/50" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </SafeChartContainer>
                <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center pb-2">
                    <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">
                        {Math.round(value)}%
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-1">
                        {label}
                    </span>
                </div>
            </div>
            {description && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 text-center max-w-[140px]">
                    {description}
                </p>
            )}
        </div>
    );
}

interface DashboardGaugesProps {
    income: number;
    expense: number;
}

export function DashboardGauges({ income, expense }: DashboardGaugesProps) {
    // Profit Margin = (Income - Expense) / Income
    const profitMargin = income > 0 ? Math.max(0, ((income - expense) / income) * 100) : 0;
    
    // Financial Health Score (simple mock logic: how much is left vs what went out)
    // 0% if balance is negative, up to 100% if saving double expenses
    const healthScore = income > 0 ? Math.min(100, Math.max(0, (income / (expense * 1.5 || 1)) * 50)) : 0;

    return (
        <div className="glass-card p-6 rounded-2xl transition-all hover:shadow-2xl hover:translate-y-[-2px] duration-300">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Eficiência Operacional
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <Gauge 
                    value={profitMargin} 
                    label="Margem de Lucro" 
                    description="O quanto da receita sobra após as despesas."
                    color="#10b981"
                />
                <Gauge 
                    value={healthScore} 
                    label="Saúde de Caixa" 
                    description="Capacidade de cobrir gastos futuros."
                    color="#6366f1"
                />
            </div>
        </div>
    );
}
