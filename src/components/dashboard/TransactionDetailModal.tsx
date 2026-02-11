import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Transaction {
    id: string;
    type: 'income' | 'expense';
    status: 'pending' | 'received' | 'paid';
    amount: number;
    paid_amount?: number;
    interest?: number;
    penalty?: number;
    description: string;
    category?: string;
    date: string;
}

interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    transactions: Transaction[];
    type: 'income' | 'expense' | 'receivable' | 'payable' | 'balance';
}

export function TransactionDetailModal({
    isOpen,
    onClose,
    title,
    transactions,
    type
}: TransactionDetailModalProps) {
    if (!isOpen) return null;

    // Group transactions by category
    const categoryTotals = transactions.reduce((acc, t) => {
        const cat = t.category || 'Sem Categoria';
        const amount = t.paid_amount || t.amount;
        const signedAmount = t.type === 'income' ? Number(amount) : -Number(amount);
        acc[cat] = (acc[cat] || 0) + signedAmount;
        return acc;
    }, {} as Record<string, number>);

    // Calculate net total (income - expense)
    const total = transactions.reduce((acc, t) => {
        const amount = Number(t.paid_amount || t.amount);
        return acc + (t.type === 'income' ? amount : -amount);
    }, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {transactions.length} transação(ões) • Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Transaction List */}
                        <div className="lg:col-span-2 space-y-3">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transações</h3>
                            {transactions.length === 0 ? (
                                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                                    Nenhuma transação encontrada
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {transactions.map((transaction) => (
                                        <div
                                            key={transaction.id}
                                            className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            <div className="flex-1">
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {transaction.description}
                                                </p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {format(new Date(transaction.date), "dd 'de' MMMM", { locale: ptBR })}
                                                    </span>
                                                    {transaction.category && (
                                                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                                            {transaction.category}
                                                        </span>
                                                    )}
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${transaction.status === 'received' || transaction.status === 'paid'
                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                        }`}>
                                                        {transaction.status === 'received' ? 'Recebido' :
                                                            transaction.status === 'paid' ? 'Pago' : 'Pendente'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${transaction.type === 'income'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {transaction.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.paid_amount || transaction.amount)}
                                                </p>
                                                {((transaction.interest || 0) > 0 || (transaction.penalty || 0) > 0) && (
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                                        (Orig: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.amount)}
                                                        {Number(transaction.interest) > 0 && ` + J: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.interest || 0)}`}
                                                        {Number(transaction.penalty) > 0 && ` + M: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.penalty || 0)}`}
                                                        )
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Category Breakdown */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Por Categoria</h3>
                            <div className="space-y-3">
                                {Object.entries(categoryTotals)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([category, amount]) => {
                                        const percentage = (amount / total) * 100;
                                        return (
                                            <div key={category} className="space-y-1">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                                                        {category}
                                                    </span>
                                                    <span className="text-gray-900 dark:text-white font-semibold">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full ${type === 'income' || type === 'receivable'
                                                            ? 'bg-green-500'
                                                            : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {percentage.toFixed(1)}% do total
                                                </p>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
                    <Button variant="outline" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            </div>
        </div>
    );
}
