import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
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
import { useCRM } from '../hooks/useCRM';

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
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'late'>('all');
    const [searchQuery, setSearchQuery] = useState('');

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
        let result = transactions.filter(t => isInRange(t.date));

        // Status filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'paid') {
                result = result.filter(t => t.status === 'paid' || t.status === 'received');
            } else {
                result = result.filter(t => t.status === statusFilter);
            }
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t =>
                t.description?.toLowerCase().includes(q) ||
                (t.contact as any)?.name?.toLowerCase().includes(q) ||
                (t.category as any)?.name?.toLowerCase().includes(q)
            );
        }

        return result;
    }, [transactions, startDate, endDate, statusFilter, searchQuery]);

    // Status counts for filter tabs (must be above early returns - Rules of Hooks)
    const dateFiltered = useMemo(() => transactions.filter(t => isInRange(t.date)), [transactions, startDate, endDate]);
    const statusCounts = useMemo(() => ({
        all: dateFiltered.length,
        pending: dateFiltered.filter(t => t.status === 'pending').length,
        paid: dateFiltered.filter(t => t.status === 'paid' || t.status === 'received').length,
        late: dateFiltered.filter(t => t.status === 'late').length,
    }), [dateFiltered]);

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

    const { updateDeal, stages: crmStages } = useCRM();

    const handleSettleConfirm = async (date: string, paymentMethod: string, interest: number, penalty: number, totalAmount: number, baseAmount?: number) => {
        if (!settlingTransaction) return;

        const newStatus = type === 'expense' ? 'paid' : 'received';
        const updates: any = {
            status: newStatus,
            payment_date: date,
            payment_method: paymentMethod || undefined,
            interest,
            penalty,
            paid_amount: totalAmount
        };

        if (baseAmount !== undefined) {
            updates.amount = baseAmount;
        }

        await updateTransaction(settlingTransaction.id, updates);

        // 🏆 Phase 2: Auto-Winning Deals
        // If it's a receivable (income) being received and has a deal_id
        if (type === 'income' && settlingTransaction.deal_id && crmStages.length > 0) {
            try {
                // Find "Won" stage or use the last one
                const wonStage = crmStages.find((s: any) =>
                    s.name.toLowerCase().includes('ganho') ||
                    s.name.toLowerCase().includes('fechado')
                ) || crmStages[crmStages.length - 1];

                await updateDeal(settlingTransaction.deal_id, {
                    stage_id: wonStage.id,
                    status: 'won', // Update status to won as well
                    updated_at: new Date().toISOString()
                });
                console.log('✅ Deal auto-won after payment confirmation');
            } catch (err) {
                console.error('Failed to auto-win deal:', err);
            }
        }

        setSettlingTransaction(null);
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) {
            alert('Você não tem permissão para excluir registros.');
            return;
        }

        // Find transaction to check status
        const transaction = transactions.find(t => t.id === id);

        if (!canDelete) {
            // 🔒 Check if transaction is protected
            if (transaction && (transaction.status === 'paid' || transaction.status === 'received')) {
                alert('🔒 Não é possível excluir transações pagas ou recebidas sem permissão de administrador.');
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

    // Calculate breakdown by status
    const paidTotal = filteredTransactions
        .filter(t => t.status === 'paid' || t.status === 'received')
        .reduce((acc, t) => acc + (t.paid_amount || t.amount), 0);

    const pendingTotal = filteredTransactions
        .filter(t => t.status === 'pending')
        .reduce((acc, t) => acc + t.amount, 0);

    const lateTotal = filteredTransactions
        .filter(t => t.status === 'late')
        .reduce((acc, t) => acc + t.amount, 0);


    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>

                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Month Picker Quick Select */}
                        <Tooltip content="Seleção Rápida por Mês">
                            <input
                                type="month"
                                value={monthFilter}
                                onChange={handleMonthChange}
                                className="px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                            />
                        </Tooltip>
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

            {/* Status Filter Tabs + Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                    {[
                        { key: 'all' as const, label: 'Todos', count: statusCounts.all },
                        { key: 'pending' as const, label: 'Pendente', count: statusCounts.pending },
                        { key: 'paid' as const, label: type === 'expense' ? 'Pago' : 'Recebido', count: statusCounts.paid },
                        { key: 'late' as const, label: 'Atrasado', count: statusCounts.late },
                    ].filter(t => t.key === 'all' || t.count > 0).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setStatusFilter(tab.key)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${statusFilter === tab.key
                                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab.label}
                            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${statusFilter === tab.key
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-gray-400'
                                }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:w-64">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar descrição, contato..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

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
                    isVariableAmount={settlingTransaction.is_variable_amount}
                />
            )}

            {/* Fixed Summary Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 shadow-lg z-10 md:pl-64">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Exibindo {filteredTransactions.length} lançamentos
                    </div>
                    <div className="flex items-center gap-5">
                        {/* Paid/Received */}
                        {paidTotal > 0 && (
                            <div className="text-right">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 block uppercase tracking-wider font-medium">
                                    {type === 'expense' ? 'Pago' : 'Recebido'}
                                </span>
                                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                    {formatCurrency(paidTotal)}
                                </span>
                            </div>
                        )}
                        {/* Pending */}
                        {pendingTotal > 0 && (
                            <div className="text-right">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 block uppercase tracking-wider font-medium">
                                    Pendente
                                </span>
                                <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">
                                    {formatCurrency(pendingTotal)}
                                </span>
                            </div>
                        )}
                        {/* Late */}
                        {lateTotal > 0 && (
                            <div className="text-right">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 block uppercase tracking-wider font-medium">
                                    Atrasado
                                </span>
                                <span className="text-sm font-bold text-red-600 dark:text-red-400">
                                    {formatCurrency(lateTotal)}
                                </span>
                            </div>
                        )}
                        {/* Separator */}
                        <div className="w-px h-8 bg-gray-200 dark:bg-slate-600 hidden sm:block" />
                        {/* Total */}
                        <div className="text-right">
                            <span className="text-xs text-gray-500 dark:text-gray-400 block uppercase tracking-wider">Valor Total</span>
                            <span className={`text-xl font-bold ${type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {formatCurrency(paidTotal + pendingTotal + lateTotal)}
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
