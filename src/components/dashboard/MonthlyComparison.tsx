import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface MonthlyComparisonProps {
    currentIncome: number;
    currentExpense: number;
    previousIncome: number;
    previousExpense: number;
    currentMonthLabel: string;
    previousMonthLabel: string;
}

export function MonthlyComparison({
    currentIncome,
    currentExpense,
    previousIncome,
    previousExpense,
    currentMonthLabel,
    previousMonthLabel,
}: MonthlyComparisonProps) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const calcChange = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };

    const incomeChange = calcChange(currentIncome, previousIncome);
    const expenseChange = calcChange(currentExpense, previousExpense);
    const currentBalance = currentIncome - currentExpense;
    const previousBalance = previousIncome - previousExpense;
    const balanceChange = calcChange(currentBalance, Math.abs(previousBalance) > 0 ? previousBalance : 1);


    const ComparisonCard = ({
        label,
        current,
        previous,
        change,
        isPositiveGood,
    }: {
        label: string;
        current: number;
        previous: number;
        change: number;
        isPositiveGood: boolean;
    }) => {
        const isGood = isPositiveGood ? change >= 0 : change <= 0;
        const absChange = Math.abs(change);
        const ChangeIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

        return (
            <div className="flex-1 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{label}</p>
                <div className="flex items-end justify-between gap-2">
                    <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(current)}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            ant: {formatCurrency(previous)}
                        </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${isGood
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                        <ChangeIcon size={13} />
                        {absChange.toFixed(1)}%
                    </div>
                </div>
            </div>
        );
    };

    const hasData = currentIncome > 0 || currentExpense > 0 || previousIncome > 0 || previousExpense > 0;
    if (!hasData) return null;

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={20} className="text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Comparativo Mensal
                </h3>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                    {previousMonthLabel} → {currentMonthLabel}
                </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <ComparisonCard
                    label="Receitas"
                    current={currentIncome}
                    previous={previousIncome}
                    change={incomeChange}
                    isPositiveGood={true}
                />
                <ComparisonCard
                    label="Despesas"
                    current={currentExpense}
                    previous={previousExpense}
                    change={expenseChange}
                    isPositiveGood={false}
                />
                <ComparisonCard
                    label="Resultado"
                    current={currentBalance}
                    previous={previousBalance}
                    change={balanceChange}
                    isPositiveGood={true}
                />
            </div>
        </div>
    );
}
