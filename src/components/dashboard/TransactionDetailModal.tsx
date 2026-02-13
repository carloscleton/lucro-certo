import { ListFilter, Coffee } from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '../ui/Modal';

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
    type?: 'income' | 'expense' | 'receivable' | 'payable' | 'balance' | 'rejected';
}

export function TransactionDetailModal({
    isOpen,
    onClose,
    title,
    transactions,
    type = 'balance'
}: TransactionDetailModalProps) {
    if (!isOpen) return null;

    const variantMap: Record<string, any> = {
        income: 'success',
        expense: 'danger',
        receivable: 'info',
        payable: 'warning',
        rejected: 'recovery',
        balance: 'primary'
    };

    const variant = variantMap[type] || 'primary';

    const colorClasses: Record<string, string> = {
        income: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-emerald-500/10',
        expense: 'text-rose-500 bg-rose-50 dark:bg-rose-900/20 shadow-rose-500/10',
        receivable: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-blue-500/10',
        payable: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-orange-500/10',
        rejected: 'text-pink-500 bg-pink-50 dark:bg-pink-900/20 shadow-pink-500/10',
        balance: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-purple-500/10'
    };

    const iconColor = colorClasses[type] || colorClasses.balance;

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

    const subtitle = `${transactions.length} transação(ões) • Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}`;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            subtitle={subtitle}
            icon={ListFilter}
            maxWidth="max-w-4xl"
            variant={variant}
        >
            <div className="flex flex-col h-full max-h-[70vh]">
                {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                        <div className={`p-4 rounded-full shadow-sm mb-4 ${iconColor}`}>
                            <Coffee className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nenhum movimento encontrado</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-xs text-center mt-1">
                            Não há registros de {title.toLowerCase()} para o período selecionado no seu resumo.
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Transaction List */}
                            <div className="lg:col-span-2 space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-700 pb-2">Transações</h3>
                                <div className="space-y-3">
                                    {transactions
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((transaction) => (
                                            <div
                                                key={transaction.id}
                                                className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 hover:shadow-md transition-all group"
                                            >
                                                <div className="flex-1">
                                                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                        {transaction.description}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                            {format(new Date(transaction.date), "dd 'de' MMMM", { locale: ptBR })}
                                                        </span>
                                                        {transaction.category && (
                                                            <span className="text-[10px] px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 rounded-full font-medium">
                                                                {transaction.category}
                                                            </span>
                                                        )}
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${transaction.status === 'received' || transaction.status === 'paid'
                                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300'
                                                            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300'
                                                            }`}>
                                                            {transaction.status === 'received' ? 'Recebido' :
                                                                transaction.status === 'paid' ? 'Pago' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-bold text-lg ${transaction.type === 'income'
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-rose-600 dark:text-rose-400'
                                                        }`}>
                                                        {transaction.type === 'income' ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(transaction.paid_amount || transaction.amount)}
                                                    </p>
                                                    {((transaction.interest || 0) > 0 || (transaction.penalty || 0) > 0) && (
                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
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
                            </div>

                            {/* Category Breakdown */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-700 pb-2">Por Categoria</h3>
                                <div className="space-y-5 bg-gray-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                                    {Object.entries(categoryTotals)
                                        .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                                        .map(([category, amount]) => {
                                            const absAmount = Math.abs(amount);
                                            const totalAbs = Object.values(categoryTotals).reduce((a, b) => a + Math.abs(b), 0);
                                            const percentage = totalAbs > 0 ? (absAmount / totalAbs) * 100 : 0;

                                            return (
                                                <div key={category} className="space-y-2">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                                                            {category}
                                                        </span>
                                                        <span className="text-gray-900 dark:text-white font-bold">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(amount))}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${amount >= 0
                                                                ? 'bg-emerald-500'
                                                                : 'bg-rose-500'
                                                                }`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-500 text-right font-medium">
                                                        {percentage.toFixed(1)}% do total
                                                    </p>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
                    <Button variant="outline" onClick={onClose} className="px-8 border-gray-200 dark:border-slate-600">
                        Fechar
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
