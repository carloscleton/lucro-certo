import { ArrowDownCircle, ArrowUpCircle, DollarSign, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import type { DashboardMetrics } from '../../hooks/useDashboard';

interface DashboardCardsProps {
    metrics: DashboardMetrics;
    previousPeriod?: { income: number; expense: number };
    onCardClick?: (type: 'income' | 'expense' | 'receivable' | 'payable' | 'balance' | 'rejected') => void;
}

export function DashboardCards({ metrics, previousPeriod, onCardClick }: DashboardCardsProps) {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(val);

    const calculateGrowth = (current: number, previous: number) => {
        if (!previous || previous === 0) return null;
        const growth = ((current - previous) / previous) * 100;
        return growth.toFixed(1);
    };

    const incomeGrowth = previousPeriod ? calculateGrowth(metrics.income, previousPeriod.income) : null;
    const expenseGrowth = previousPeriod ? calculateGrowth(metrics.expense, previousPeriod.expense) : null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Receitas */}
            <div
                onClick={() => onCardClick?.('income')}
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20 dark:border-slate-700/30 transition-all cursor-pointer hover:shadow-xl hover:translate-y-[-2px] group"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] font-bold uppercase tracking-wider">Receitas (Efetuado)</p>
                        <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                            {formatCurrency(metrics.income)}
                        </h3>
                        {incomeGrowth && (
                            <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${Number(incomeGrowth) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {Number(incomeGrowth) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {incomeGrowth}% <span className="opacity-60 font-medium">vs mês anterior</span>
                            </div>
                        )}
                    </div>
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                        <ArrowUpCircle size={22} />
                    </div>
                </div>
            </div>

            {/* Despesas */}
            <div
                onClick={() => onCardClick?.('expense')}
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20 dark:border-slate-700/30 transition-all cursor-pointer hover:shadow-xl hover:translate-y-[-2px] group"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] font-bold uppercase tracking-wider">Despesas (Pago)</p>
                        <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                            {formatCurrency(metrics.expense)}
                        </h3>
                        {expenseGrowth && (
                            <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${Number(expenseGrowth) <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {Number(expenseGrowth) <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                                {Math.abs(Number(expenseGrowth))}% <span className="opacity-60 font-medium">vs mês anterior</span>
                            </div>
                        )}
                    </div>
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-900/20 rounded-xl text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
                        <ArrowDownCircle size={22} />
                    </div>
                </div>
            </div>

            {/* A Pagar */}
            <div
                onClick={() => onCardClick?.('payable')}
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20 dark:border-slate-700/30 transition-all cursor-pointer hover:shadow-xl hover:translate-y-[-2px] group"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] font-bold uppercase tracking-wider">Compromissos</p>
                        <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                            {formatCurrency(metrics.totalPayable)}
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-2 font-medium">Pendentes no período</p>
                    </div>
                    <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                        <DollarSign size={22} />
                    </div>
                </div>
            </div>

            {/* A Receber */}
            <div
                onClick={() => onCardClick?.('receivable')}
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20 dark:border-slate-700/30 transition-all cursor-pointer hover:shadow-xl hover:translate-y-[-2px] group"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] font-bold uppercase tracking-wider">A Receber</p>
                        <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                            {formatCurrency(metrics.totalReceivable)}
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-2 font-medium">Expectativa de entrada</p>
                    </div>
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Wallet size={22} />
                    </div>
                </div>
            </div>

            {/* Recuperação */}
            <div
                onClick={() => onCardClick?.('rejected')}
                className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/20 dark:border-slate-700/30 transition-all cursor-pointer hover:shadow-xl hover:translate-y-[-2px] group"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] font-bold uppercase tracking-wider">Recuperação</p>
                        <h3 className="text-2xl font-black mt-1 text-gray-900 dark:text-white">
                            {formatCurrency(metrics.rejectedTotal)}
                        </h3>
                        <p className="text-[10px] text-pink-500 mt-2 font-bold uppercase tracking-tighter">
                            {metrics.rejectedCount} Oportunidade{metrics.rejectedCount !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="p-2.5 bg-pink-50 dark:bg-pink-900/20 rounded-xl text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform">
                        <ArrowDownCircle size={22} className="rotate-45" />
                    </div>
                </div>
            </div>
        </div>
    );
}
