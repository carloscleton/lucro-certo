import { ArrowDownCircle, ArrowUpCircle, DollarSign, Wallet } from 'lucide-react';
import type { DashboardMetrics } from '../../hooks/useDashboard';

interface DashboardCardsProps {
    metrics: DashboardMetrics;
    onCardClick?: (type: 'income' | 'expense' | 'receivable' | 'payable' | 'balance' | 'rejected') => void;
}

export function DashboardCards({ metrics, onCardClick }: DashboardCardsProps) {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div
                onClick={() => onCardClick?.('income')}
                className="bg-green-50 dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-green-100 dark:border-green-900/50 transition-all cursor-pointer hover:shadow-md hover:scale-105 hover:bg-green-100 dark:hover:bg-slate-800/80"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-green-700 dark:text-gray-400 text-sm font-medium">Receitas (Mês)</p>
                        <h3 className="text-2xl font-bold mt-1 text-green-700 dark:text-green-400">
                            {formatCurrency(metrics.income)}
                        </h3>
                    </div>
                    <div className="p-2 bg-white/60 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400 backdrop-blur-sm">
                        <ArrowUpCircle size={24} />
                    </div>
                </div>
            </div>

            <div
                onClick={() => onCardClick?.('expense')}
                className="bg-red-50 dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-red-100 dark:border-red-900/50 transition-all cursor-pointer hover:shadow-md hover:scale-105 hover:bg-red-100 dark:hover:bg-slate-800/80"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-red-700 dark:text-gray-400 text-sm font-medium">Despesas (Mês)</p>
                        <h3 className="text-2xl font-bold mt-1 text-red-700 dark:text-red-400">
                            {formatCurrency(metrics.expense)}
                        </h3>
                    </div>
                    <div className="p-2 bg-white/60 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 backdrop-blur-sm">
                        <ArrowDownCircle size={24} />
                    </div>
                </div>
            </div>

            <div
                onClick={() => onCardClick?.('payable')}
                className="bg-orange-50 dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-orange-100 dark:border-orange-900/50 transition-all cursor-pointer hover:shadow-md hover:scale-105 hover:bg-orange-100 dark:hover:bg-slate-800/80"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-orange-800 dark:text-gray-400 text-sm font-medium">A Pagar (Pendente)</p>
                        <h3 className="text-2xl font-bold mt-1 text-orange-700 dark:text-orange-400">
                            {formatCurrency(metrics.totalPayable)}
                        </h3>
                    </div>
                    <div className="p-2 bg-white/60 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400 backdrop-blur-sm">
                        <DollarSign size={24} />
                    </div>
                </div>
            </div>

            <div
                onClick={() => onCardClick?.('receivable')}
                className="bg-blue-50 dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-blue-100 dark:border-blue-900/50 transition-all cursor-pointer hover:shadow-md hover:scale-105 hover:bg-blue-100 dark:hover:bg-slate-800/80"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-blue-700 dark:text-gray-400 text-sm font-medium">A Receber (Pendente)</p>
                        <h3 className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">
                            {formatCurrency(metrics.totalReceivable)}
                        </h3>
                    </div>
                    <div className="p-2 bg-white/60 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 backdrop-blur-sm">
                        <Wallet size={24} />
                    </div>
                </div>
            </div>

            <div
                onClick={() => onCardClick?.('rejected')}
                className="bg-pink-50 dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-pink-100 dark:border-pink-900/50 transition-all cursor-pointer hover:shadow-md hover:scale-105 hover:bg-pink-100 dark:hover:bg-slate-800/80"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-pink-700 dark:text-gray-400 text-sm font-medium">Recuperação</p>
                        <h3 className="text-2xl font-bold mt-1 text-pink-700 dark:text-pink-400">
                            {formatCurrency(metrics.rejectedTotal)}
                        </h3>
                        <p className="text-xs text-pink-600/70 dark:text-gray-500 mt-1">{metrics.rejectedCount} orçamentos</p>
                    </div>
                    <div className="p-2 bg-white/60 dark:bg-pink-900/30 rounded-lg text-pink-600 dark:text-pink-400 backdrop-blur-sm">
                        <ArrowDownCircle size={24} className="rotate-45" />
                    </div>
                </div>
            </div>
        </div>
    );
}
