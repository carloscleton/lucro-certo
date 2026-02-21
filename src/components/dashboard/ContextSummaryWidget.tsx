import { User, Building2, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import type { ContextMetrics } from '../../hooks/useDashboard';

interface ContextSummaryWidgetProps {
    contextMetrics: ContextMetrics;
}

export function ContextSummaryWidget({ contextMetrics }: ContextSummaryWidgetProps) {
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const { personal, business } = contextMetrics;

    const hasData = personal.income > 0 || personal.expense > 0 || business.income > 0 || business.expense > 0;

    if (!hasData) return null;

    const ContextCard = ({
        icon: Icon,
        label,
        sublabel,
        income,
        expense,
        balance,
        colorClass,
        bgClass,
        borderClass,
    }: {
        icon: any;
        label: string;
        sublabel: string;
        income: number;
        expense: number;
        balance: number;
        colorClass: string;
        bgClass: string;
        borderClass: string;
    }) => (
        <div className={`flex-1 rounded-xl border ${borderClass} ${bgClass} p-5 transition-all hover:shadow-md`}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${colorClass} bg-white/50 dark:bg-white/10`}>
                    <Icon size={20} />
                </div>
                <div>
                    <p className="font-semibold text-gray-800 dark:text-white text-sm">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sublabel}</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                {/* Income */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingUp size={13} className="text-emerald-500" />
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Receitas</span>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(income)}</p>
                </div>

                {/* Expense */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <TrendingDown size={13} className="text-red-500" />
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Despesas</span>
                    </div>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(expense)}</p>
                </div>

                {/* Balance */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <Scale size={13} className={balance >= 0 ? 'text-blue-500' : 'text-orange-500'} />
                        <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Saldo</span>
                    </div>
                    <p className={`text-sm font-bold ${balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {formatCurrency(balance)}
                    </p>
                </div>
            </div>

            {/* Progress bar: expense vs income */}
            {income > 0 && (
                <div className="mt-4">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>Comprometido</span>
                        <span>{Math.min(Math.round((expense / income) * 100), 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-1.5 overflow-hidden">
                        <div
                            className={`h-1.5 rounded-full transition-all ${expense / income >= 1 ? 'bg-red-500' : expense / income >= 0.7 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min((expense / income) * 100, 100)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Comparativo do Período
                </h3>
                <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
                <ContextCard
                    icon={User}
                    label="Pessoal"
                    sublabel="Pessoa física"
                    income={personal.income}
                    expense={personal.expense}
                    balance={personal.balance}
                    colorClass="text-violet-600 dark:text-violet-400"
                    bgClass="bg-violet-50 dark:bg-violet-900/20"
                    borderClass="border-violet-200 dark:border-violet-800"
                />
                <ContextCard
                    icon={Building2}
                    label="Empresarial"
                    sublabel="Pessoa jurídica"
                    income={business.income}
                    expense={business.expense}
                    balance={business.balance}
                    colorClass="text-cyan-600 dark:text-cyan-400"
                    bgClass="bg-cyan-50 dark:bg-cyan-900/20"
                    borderClass="border-cyan-200 dark:border-cyan-800"
                />
            </div>
        </div>
    );
}
