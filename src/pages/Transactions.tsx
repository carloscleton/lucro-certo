import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTransactions } from '../hooks/useTransactions';
import type { Transaction } from '../hooks/useTransactions';
import { TransactionList } from '../components/transactions/TransactionList';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { SettleModal } from '../components/transactions/SettleModal';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { useCompanies } from '../hooks/useCompanies';
import { useTeam } from '../hooks/useTeam';

interface TransactionPageProps {
    type: 'expense' | 'income';
    title: string;
}

function TransactionPage({ type, title }: TransactionPageProps) {
    const navigate = useNavigate();
    const { transactions, loading, error, addTransaction, updateTransaction, deleteTransaction } = useTransactions(type);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [settlingTransaction, setSettlingTransaction] = useState<Transaction | null>(null);

    // Initial State: Current Month
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Calculate start/end dates from month string
    const getMonthRange = (monthStr: string) => {
        const [year, month] = monthStr.split('-').map(Number);
        const start = `${monthStr}-01`;
        const lastDay = new Date(year, month, 0).getDate(); // day 0 of next month is last day of this month
        const end = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
        return { start, end };
    };

    const initialRange = getMonthRange(new Date().toISOString().slice(0, 7));
    const [startDate, setStartDate] = useState(initialRange.start);
    const [endDate, setEndDate] = useState(initialRange.end);

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMonthFilter(value);
        if (value) {
            const { start, end } = getMonthRange(value);
            setStartDate(start);
            setEndDate(end);
        }
    };

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartDate(e.target.value);
        setMonthFilter(''); // Clear month selection if manual date is picked
    };

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndDate(e.target.value);
        setMonthFilter(''); // Clear month selection if manual date is picked
    };

    // Helper to check if date is in range
    const isInRange = (dateStr: string) => {
        return dateStr >= startDate && dateStr <= endDate;
    };

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => isInRange(t.date));
    }, [transactions, startDate, endDate]);

    // Permission Check
    const { user } = useAuth();
    const { currentEntity } = useEntity();
    const { companies } = useCompanies();
    const { members } = useTeam();

    let canDelete = true;
    if (currentEntity.type === 'company' && user) {
        const company = companies.find(c => c.id === currentEntity.id);
        const myMembership = members.find(m => m.user_id === user.id);

        // Default to safe permission (false) if data is missing, unless confirmed owner/admin
        const isOwnerOrAdmin = myMembership?.role === 'owner' || myMembership?.role === 'admin';
        const memberCanDelete = company?.settings?.member_can_delete ?? false; // Default false (secure by default)

        if (!isOwnerOrAdmin && !memberCanDelete) {
            canDelete = false;
        }
    }

    const handleAddStart = () => {
        setEditingTransaction(null);
        setIsModalOpen(true);
    };

    const handleEditStart = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        setIsModalOpen(true);
    };

    const handleSubmit = async (data: any) => {
        if (editingTransaction) {
            await updateTransaction(editingTransaction.id, data);
        } else {
            await addTransaction(data);
        }
    };

    const handleToggleStatus = async (t: Transaction) => {
        if (t.status === 'pending') {
            // Open Settle Modal
            setSettlingTransaction(t);
        } else {
            // Revert directly to pending
            await updateTransaction(t.id, { status: 'pending' });
        }
    };

    const handleSettleConfirm = async (date: string, paymentMethod: string, interest: number, penalty: number, totalAmount: number) => {
        if (!settlingTransaction) return;

        const newStatus = type === 'expense' ? 'paid' : 'received';
        await updateTransaction(settlingTransaction.id, {
            status: newStatus,
            payment_date: date,
            payment_method: paymentMethod || undefined,
            interest,
            penalty,
            paid_amount: totalAmount
        });
        setSettlingTransaction(null);
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) {
            alert('Você não tem permissão para excluir registros.');
            return;
        }

        // Find transaction to check status
        const transaction = transactions.find(t => t.id === id);

        // 🔓 SUPER ADMIN: Bypass all protections
        const isSuperAdmin = user?.email === 'carloscleton.nat@gmail.com';

        if (!isSuperAdmin) {
            // 🔒 Check if transaction is protected (only for non-super-admins)
            if (transaction && (transaction.status === 'paid' || transaction.status === 'received')) {
                alert('🔒 Não é possível excluir transações pagas ou recebidas.\n\nEsta é uma medida de segurança para proteger dados financeiros.\n\nSe necessário, um administrador pode criar um estorno.');
                return;
            }
        }

        if (confirm('Tem certeza que deseja excluir?')) {
            try {
                await deleteTransaction(id);
            } catch (error: any) {
                alert(error.message || 'Erro ao excluir transação');
            }
        }
    };

    const handleViewQuote = (quoteId: string) => {
        navigate(`/quotes/${quoteId}/print`);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Erro: {error}</div>;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // Calculate sum of displayed transactions
    // If it's expense: sum is negative? No, usually displayed as positive, but conceptually debt.
    // The previous request asked for "total value". Usually sum of amount.
    // However, for expenses, we might want to just show the absolute total.
    const totalValue = filteredTransactions.reduce((acc, t) => acc + (t.paid_amount || t.amount), 0);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Month Picker Quick Select */}
                        <div>
                            <input
                                type="month"
                                value={monthFilter}
                                onChange={handleMonthChange}
                                className="px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                                title="Seleção Rápida por Mês"
                            />
                        </div>
                        <span className="text-gray-400 hidden md:inline">|</span>
                        {/* Manual Date Range */}
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={handleStartDateChange}
                                className="px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                            />
                            <span className="text-gray-500">até</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={handleEndDateChange}
                                className="px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                            />
                        </div>
                    </div>

                    <Button onClick={handleAddStart} className="ml-auto md:ml-0">
                        <Plus size={20} className="mr-2" />
                        Nova {type === 'expense' ? 'Conta' : 'Receita'}
                    </Button>
                </div>
            </div>

            {/* Summary Cards could go here */}

            <TransactionList
                transactions={filteredTransactions}
                onEdit={handleEditStart}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
                canDelete={canDelete}
                onViewQuote={handleViewQuote}
            />

            <TransactionForm
                type={type}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                initialData={editingTransaction}
            />

            {settlingTransaction && (
                <SettleModal
                    isOpen={!!settlingTransaction}
                    onClose={() => setSettlingTransaction(null)}
                    onConfirm={handleSettleConfirm}
                    transactionType={type}
                    transactionAmount={settlingTransaction.amount}
                    transactionDescription={settlingTransaction.description}
                />
            )}

            {/* Fixed Summary Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 shadow-lg z-10 md:pl-64">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Exibindo {filteredTransactions.length} lançamentos
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Valor Total</span>
                            <span className={`text-xl font-bold ${type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {formatCurrency(totalValue)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add padding to prevent footer from covering content */}
            <div className="h-24"></div>
        </div>
    );
}

export function Payables() {
    return <TransactionPage type="expense" title="Contas a Pagar" />;
}

export function Receivables() {
    return <TransactionPage type="income" title="Contas a Receber" />;
}
