import { ListFilter, Coffee, Repeat, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Modal } from '../ui/Modal';

interface Transaction {
    id: string;
    type: 'income' | 'expense';
    status: 'pending' | 'received' | 'paid' | 'late';
    amount: number;
    paid_amount?: number;
    interest?: number;
    penalty?: number;
    description: string;
    category?: any;
    date: string;
    is_recurring?: boolean;
    recurrence_group_id?: string;
    installment_number?: number;
    recurring_count?: number;
}

const getCategoryName = (category: any): string => {
    if (!category) return 'Sem Categoria';
    if (typeof category === 'string') return category;
    if (typeof category === 'object' && category !== null) return category.name || 'Sem Categoria';
    return String(category);
};

interface TransactionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    transactions: Transaction[];
    type?: 'income' | 'expense' | 'receivable' | 'payable' | 'balance' | 'rejected';
    onDelete?: (id: string) => void;
    onUpdate?: (id: string) => void;
}

export function TransactionDetailModal({
    isOpen,
    onClose,
    title,
    transactions,
    type = 'balance',
    onDelete,
    onUpdate
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
        const cat = getCategoryName(t.category);
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

    const subtitle = `${transactions.length} transação(ões) • Total: ${new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(total)}`;

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
                                                className="group flex flex-col md:flex-row md:items-center justify-between p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-gray-100 dark:border-slate-700/50 hover:border-purple-200 dark:hover:border-purple-900/50 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 gap-4"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between md:justify-start gap-2 mb-1">
                                                        <h4 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                            {transaction.description}
                                                        </h4>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-[11px] font-bold text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-slate-600/50">
                                                            {format(new Date(transaction.date + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
                                                        </span>
                                                        
                                                        {transaction.category && (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-[11px] font-bold text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-800/50">
                                                                {getCategoryName(transaction.category)}
                                                            </span>
                                                        )}
                                                        
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                                                            transaction.status === 'received' || transaction.status === 'paid'
                                                                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-800/50'
                                                                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100/50 dark:border-amber-800/50'
                                                        }`}>
                                                            {transaction.status === 'received' ? 'Recebido' :
                                                                transaction.status === 'paid' ? 'Pago' : 'Pendente'}
                                                        </span>
                                                        
                                                        {(transaction.is_recurring || transaction.recurrence_group_id) && (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-[11px] font-extrabold text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-800/50 uppercase tracking-tighter">
                                                                <Repeat className="w-3 h-3" />
                                                                {transaction.installment_number && transaction.recurring_count ? `${transaction.installment_number}/${transaction.recurring_count}` : 'Recorr'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between md:justify-end gap-6 md:min-w-[200px]">
                                                    <div className="text-right">
                                                        <p className={`text-lg font-black tracking-tight ${
                                                            transaction.type === 'income'
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-rose-600 dark:text-rose-400'
                                                        }`}>
                                                            {transaction.type === 'income' ? '+' : '-'} {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(transaction.paid_amount || transaction.amount)}
                                                        </p>
                                                        {((transaction.interest || 0) > 0 || (transaction.penalty || 0) > 0) && (
                                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                                Base: {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(transaction.amount)}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {onUpdate && (transaction.status === 'pending' || transaction.status === 'late') && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    onUpdate(transaction.id);
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/20 group/btn"
                                                            >
                                                                <CheckCircle size={14} className="group-hover/btn:scale-110 transition-transform" />
                                                                {transaction.type === 'expense' ? 'PAGAR' : 'RECEBER'}
                                                            </button>
                                                        )}
                                                        
                                                        {onDelete && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    onDelete(transaction.id);
                                                                }}
                                                                className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all active:scale-90 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/50"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Category Breakdown */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-700 pb-2">Por Categoria</h3>
                                <div className="space-y-5 bg-gray-50/50 dark:bg-slate-900/40 p-5 rounded-3xl border border-gray-100 dark:border-slate-800/60 backdrop-blur-sm">
                                    {Object.entries(categoryTotals)
                                        .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                                        .map(([category, amount]) => {
                                            const absAmount = Math.abs(amount);
                                            const totalAbs = Object.values(categoryTotals).reduce((a, b) => a + Math.abs(b), 0);
                                            const percentage = totalAbs > 0 ? (absAmount / totalAbs) * 100 : 0;

                                            return (
                                                <div key={category} className="space-y-2.5">
                                                    <div className="flex items-center justify-between text-xs px-0.5">
                                                        <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tight">
                                                            {category}
                                                        </span>
                                                        <span className="text-gray-900 dark:text-white font-black">
                                                            {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(Math.abs(amount))}
                                                        </span>
                                                    </div>
                                                    <div className="relative w-full bg-gray-200/50 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden border border-gray-100 dark:border-slate-600/30">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${amount >= 0
                                                                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                                                : 'bg-gradient-to-r from-rose-500 to-rose-400'
                                                                }`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-end">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-[9px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">
                                                            {percentage.toFixed(1)}% do total
                                                        </span>
                                                    </div>
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
