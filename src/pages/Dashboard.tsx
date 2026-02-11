import { useDashboard } from '../hooks/useDashboard';
import { DashboardCards } from '../components/dashboard/DashboardCards';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { Alerts } from '../components/dashboard/Alerts';
import { BudgetProgress } from '../components/dashboard/BudgetProgress';
import { PendingList } from '../components/dashboard/PendingList';
import { UpcomingBillsWidget } from '../components/dashboard/UpcomingBillsWidget';
import { useCategories } from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransactionDetailModal } from '../components/dashboard/TransactionDetailModal';

export function Dashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();

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

    const { metrics, chartData, alerts, expensesByCategory, pendingList, transactions, loading, refresh: refreshDashboard } = useDashboard(startDate, endDate);
    const { categories } = useCategories();

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'income' | 'expense' | 'receivable' | 'payable' | 'balance'>('income');
    const [modalTitle, setModalTitle] = useState('');

    // Click handlers for cards
    const handleCardClick = (type: 'income' | 'expense' | 'receivable' | 'payable' | 'balance' | 'rejected') => {
        if (type === 'rejected') {
            navigate('/quotes', { state: { viewMode: 'recovery' } });
            return;
        }

        setModalType(type as any);
        setModalOpen(true);

        const titles = {
            income: 'Receitas (Mês)',
            expense: 'Despesas (Mês)',
            receivable: 'A Receber (Pendentes)',
            payable: 'A Pagar (Pendentes)',
            balance: 'Saldo Atual'
        };
        setModalTitle(titles[type]);
    };

    // Filter transactions based on modal type
    const getFilteredTransactions = () => {
        if (!transactions) return [];

        const periodTransactions = transactions.filter(t =>
            t.date >= startDate && t.date <= endDate
        );

        switch (modalType) {
            case 'income':
                return periodTransactions.filter(t => t.type === 'income' && t.status === 'received');
            case 'expense':
                return periodTransactions.filter(t => t.type === 'expense' && t.status === 'paid');
            case 'receivable':
                return transactions.filter(t => t.type === 'income' && t.status === 'pending');
            case 'payable':
                return transactions.filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'late'));
            case 'balance':
                return periodTransactions.filter(t =>
                    (t.type === 'income' && t.status === 'received') ||
                    (t.type === 'expense' && t.status === 'paid')
                );
            default:
                return [];
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando dashboard...</div>;

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';
    const firstName = profile?.full_name?.split(' ')[0] || 'Usuário';

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{greeting}, {firstName}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Aqui está o resumo financeiro.</p>
                </div>

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
            </div>

            <Alerts alerts={alerts} />

            <DashboardCards metrics={metrics} onCardClick={handleCardClick} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <DashboardCharts data={chartData} />
                    <PendingList transactions={pendingList} />
                    <BudgetProgress categories={categories} expenses={expensesByCategory} />
                </div>

                <div className="space-y-6">
                    {/* Upcoming Bills Widget */}
                    <UpcomingBillsWidget onRefreshMetrics={refreshDashboard} />

                    {/* Quick Summary Card */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Resumo Rápido</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Resultado do Período</p>
                                <p className={`text-xl font-bold ${metrics.income - metrics.expense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.income - metrics.expense)}
                                </p>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                "O segredo de ficar rico é gastar menos do que se ganha e investir a diferença."
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction Detail Modal */}
            <TransactionDetailModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={modalTitle}
                transactions={getFilteredTransactions()}
            />
        </div>
    );
}
