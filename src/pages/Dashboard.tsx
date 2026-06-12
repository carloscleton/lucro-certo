import { useDashboard } from '../hooks/useDashboard';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../components/ui/Tooltip';
import { DashboardCards } from '../components/dashboard/DashboardCards';
import { DashboardCharts } from '../components/dashboard/DashboardCharts';
import { Alerts } from '../components/dashboard/Alerts';
import { BudgetProgress } from '../components/dashboard/BudgetProgress';
import { PendingList } from '../components/dashboard/PendingList';
import { UpcomingBillsWidget } from '../components/dashboard/UpcomingBillsWidget';
import { ExpenseByCategoryChart } from '../components/dashboard/ExpenseByCategoryChart';
import { CashFlowForecast } from '../components/dashboard/CashFlowForecast';
import { MonthlyComparison } from '../components/dashboard/MonthlyComparison';
import { useCategories } from '../hooks/useCategories';
import { useCompanies } from '../hooks/useCompanies';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransactionDetailModal } from '../components/dashboard/TransactionDetailModal';
import { useEntity } from '../context/EntityContext';
import { CRMStatsWidget } from '../components/dashboard/CRMStatsWidget';
import { LoyaltyStatsWidget } from '../components/dashboard/LoyaltyStatsWidget';
import { ContextSummaryWidget } from '../components/dashboard/ContextSummaryWidget';
import { useTransactions } from '../hooks/useTransactions';
import { useAdmin } from '../hooks/useAdmin';
import { Users, Building, DollarSign, TrendingUp } from 'lucide-react';
import { AgendaTasksWidget } from '../components/dashboard/AgendaTasksWidget';
import { SettleModal } from '../components/transactions/SettleModal';
import { DashboardGauges } from '../components/dashboard/DashboardGauges';
import { TopPerformingWidget } from '../components/dashboard/TopPerformingWidget';
import { ChoiceModal } from '../components/ui/ChoiceModal';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { ResultModal } from '../components/ui/ResultModal';
import { Trash2, CalendarRange, ListChecks } from 'lucide-react';

export function Dashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { deleteTransaction: deleteExpense, updateTransaction: updateExpense } = useTransactions('expense');
    const { deleteTransaction: deleteIncome, updateTransaction: updateIncome } = useTransactions('income');

    const handleDelete = (id: string) => {
        const transaction = transactions.find(t => t.id === id);
        if (!transaction) return;

        setTransactionToDelete(transaction);
        if (transaction.recurrence_group_id) {
            setRecurrenceChoiceOpen(true);
        } else {
            setDeleteConfirmOpen(true);
        }
    };

    const executeDelete = async (scope: 'single' | 'future' | 'all' = 'single') => {
        if (!transactionToDelete) return;

        setIsDeleting(true);
        try {
            if (transactionToDelete.type === 'expense') {
                await deleteExpense(transactionToDelete.id, scope);
            } else {
                await deleteIncome(transactionToDelete.id, scope);
            }
            
            setDeleteConfirmOpen(false);
            setRecurrenceChoiceOpen(false);
            setTransactionToDelete(null);
            
            refreshDashboard();
            setResultModal({
                isOpen: true,
                title: t('dashboard.transaction_removed'),
                message: t('dashboard.operation_success'),
                type: 'success'
            });
        } catch (error: any) {
            setResultModal({
                isOpen: true,
                title: t('dashboard.delete_error_title'),
                message: error.message || t('common.delete_error'),
                type: 'error'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const [settleModalOpen, setSettleModalOpen] = useState(false);
    const [selectedTransactionForSettle, setSelectedTransactionForSettle] = useState<any>(null);

    // Modal States for Deletion
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [recurrenceChoiceOpen, setRecurrenceChoiceOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [resultModal, setResultModal] = useState<{isOpen: boolean, title: string, message: string, type: 'success' | 'error'}>({
        isOpen: false, title: '', message: '', type: 'success'
    });

    const handleQuickPayClick = (id: string) => {
        const transaction = transactions.find(t => t.id === id);
        if (!transaction) return;
        setSelectedTransactionForSettle(transaction);
        setSettleModalOpen(true);
    };

    const handleSettleConfirm = async (date: string, paymentMethod: string, interest: number, penalty: number, totalAmount: number, notes: string, baseAmount?: number) => {
        if (!selectedTransactionForSettle) return;
        
        const type = selectedTransactionForSettle.type;
        const newStatus = type === 'expense' ? 'paid' : 'received';

        try {
            const updates: any = {
                status: newStatus,
                paid_amount: totalAmount,
                payment_date: date,
                payment_method: paymentMethod,
                interest,
                penalty,
                notes,
            };

            if (baseAmount !== undefined) {
                updates.amount = baseAmount;
                updates.is_variable_amount = false;
            }

            if (type === 'expense') {
                await updateExpense(selectedTransactionForSettle.id, updates);
            } else {
                await updateIncome(selectedTransactionForSettle.id, updates);
            }
            refreshDashboard();
        } catch (error: any) {
            setResultModal({
                isOpen: true,
                title: t('dashboard.operation_error_title'),
                message: error.message || t('dashboard.operation_error_message'),
                type: 'error'
            });
            throw error;
        }
    };

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

    const { metrics, chartData, alerts, expensesByCategory, agendaTasks, pendingList, transactions, contextMetrics, previousPeriod, loading, refresh: refreshDashboard } = useDashboard(startDate, endDate);
    const { categories, loading: categoriesLoading } = useCategories();
    const { companies } = useCompanies();
    const { currentEntity } = useEntity();




    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'income' | 'expense' | 'receivable' | 'payable' | 'balance'>('income');
    const [modalTitle, setModalTitle] = useState('');

    const { isAdmin, stats: adminStats } = useAdmin();

    if (loading || categoriesLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-500 animate-pulse">{t('common.loading') || 'Carregando dados...'}</p>
            </div>
        );
    }

    // Month labels for comparison
    const monthNames = t('dashboard.month_names', { returnObjects: true }) as string[];
    const currentDate = new Date(startDate);
    const currentMonthLabel = monthNames[currentDate.getMonth()] || '';
    const prevDate = new Date(currentDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const previousMonthLabel = monthNames[prevDate.getMonth()] || '';

    const currentCompany = companies.find(c => c.id === currentEntity.id);
    const isCRMEnabled = currentEntity.type === 'company' && currentCompany?.crm_module_enabled;
    const isLoyaltyEnabled = currentEntity.type === 'company' && currentCompany?.loyalty_module_enabled;

    // Click handlers for cards
    const handleCardClick = (type: 'income' | 'expense' | 'receivable' | 'payable' | 'balance' | 'rejected') => {
        if (type === 'rejected') {
            navigate('/dashboard/quotes', { state: { viewMode: 'recovery' } });
            return;
        }

        setModalType(type as any);
        setModalOpen(true);

        const titles = {
            income: t('dashboard.income_month'),
            expense: t('dashboard.expense_month'),
            receivable: t('dashboard.receivable_pending'),
            payable: t('dashboard.payable_pending'),
            balance: t('dashboard.current_balance')
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
                return periodTransactions.filter(t => t.type === 'income' && t.status === 'pending');
            case 'payable':
                return periodTransactions.filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'late'));
            case 'balance':
                return periodTransactions.filter(t =>
                    (t.type === 'income' && t.status === 'received') ||
                    (t.type === 'expense' && t.status === 'paid')
                );
            default:
                return [];
        }
    };

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? t('dashboard.greeting_morning') : currentHour < 18 ? t('dashboard.greeting_afternoon') : t('dashboard.greeting_evening');
    const firstName = profile?.full_name?.split(' ')[0] || t('common.user');

    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto w-full pb-10">
            {isAdmin && adminStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-3 rounded-xl border border-white/20 dark:border-slate-700/30 shadow-sm group hover:border-blue-200 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('dashboard.admin_users')}</span>
                            <Users size={14} className="text-blue-500" />
                        </div>
                        <div className="text-lg font-black text-gray-900 dark:text-white leading-tight">{adminStats.total_users}</div>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">{t('dashboard.admin_global_platform')}</div>
                    </div>

                    <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-3 rounded-xl border border-white/20 dark:border-slate-700/30 shadow-sm group hover:border-purple-200 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('dashboard.admin_companies')}</span>
                            <Building size={14} className="text-purple-500" />
                        </div>
                        <div className="text-lg font-black text-gray-900 dark:text-white leading-tight">{adminStats.total_companies}</div>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">{t('dashboard.admin_corporate_accounts')}</div>
                    </div>

                    <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-3 rounded-xl border border-white/20 dark:border-slate-700/30 shadow-sm group hover:border-emerald-200 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('dashboard.admin_commissions')}</span>
                            <DollarSign size={14} className="text-emerald-500" />
                        </div>
                        <div className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                            {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL', maximumFractionDigits: 0 }).format(adminStats.total_commission || 0)}
                        </div>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">{t('dashboard.admin_estimated_net')}</div>
                    </div>

                    <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-3 rounded-xl border border-white/20 dark:border-slate-700/30 shadow-sm group hover:border-blue-300 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{t('dashboard.volume')}</span>
                            <TrendingUp size={14} className="text-blue-600" />
                        </div>
                        <div className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                            {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL', maximumFractionDigits: 0 }).format(adminStats.total_revenue || 0)}
                        </div>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">{t('dashboard.total_processed')}</div>
                    </div>
                </div>
            )}


            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{greeting}, {firstName}</h1>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">{t('dashboard.financial_info_subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Tooltip content={t('dashboard.quick_month_select')}>
                        <input
                            type="month"
                            value={monthFilter}
                            onChange={handleMonthChange}
                            className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md px-3 py-2 border border-white/20 dark:border-slate-700/30 rounded-xl dark:text-white text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </Tooltip>
                    <span className="text-gray-300 hidden md:inline opacity-50">|</span>
                    <div className="flex items-center gap-2 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm p-1 rounded-xl border border-white/20 dark:border-slate-700/30">
                        <input
                            type="date"
                            value={startDate}
                            onChange={handleStartDateChange}
                            className="bg-transparent px-2 py-1 dark:text-white text-xs font-bold focus:outline-none"
                        />
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest px-1">{t('dashboard.until')}</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            className="bg-transparent px-2 py-1 dark:text-white text-xs font-bold focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            <Alerts alerts={alerts} onQuickPay={handleQuickPayClick} />

            <DashboardCards metrics={metrics} previousPeriod={previousPeriod} onCardClick={handleCardClick} />

            {/* Performance Grid Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 scale-in-center">
                <div className="lg:col-span-8">
                    <DashboardGauges income={metrics.income} expense={metrics.expense} />
                </div>
                <div className="lg:col-span-4">
                    <TopPerformingWidget expensesByCategory={expensesByCategory} categories={categories} />
                </div>
            </div>

            <ContextSummaryWidget contextMetrics={contextMetrics} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <DashboardCharts data={chartData} />
                    <ExpenseByCategoryChart expenses={expensesByCategory} categories={categories} />
                    <MonthlyComparison
                        currentIncome={metrics.income}
                        currentExpense={metrics.expense}
                        previousIncome={previousPeriod.income}
                        previousExpense={previousPeriod.expense}
                        currentMonthLabel={currentMonthLabel}
                        previousMonthLabel={previousMonthLabel}
                    />
                    <PendingList transactions={pendingList} />
                    <BudgetProgress categories={categories} expenses={expensesByCategory} />
                </div>

                <div className="space-y-6">
                    <AgendaTasksWidget tasks={agendaTasks} />

                    {isCRMEnabled && (
                        <CRMStatsWidget receivedIncome={metrics.income} />
                    )}

                    {isLoyaltyEnabled && (
                        <LoyaltyStatsWidget />
                    )}

                    <CashFlowForecast
                        currentBalance={metrics.balance}
                        monthlyIncome={metrics.income}
                        monthlyExpense={metrics.expense}
                        pendingReceivable={metrics.totalReceivable}
                        pendingPayable={metrics.totalPayable}
                    />

                    <UpcomingBillsWidget onRefreshMetrics={refreshDashboard} />

                    <div className="glass-card p-6 rounded-2xl transition-all hover:shadow-2xl">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-widest">{t('dashboard.quick_summary')}</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-100 dark:border-slate-800">
                                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter mb-1">{t('dashboard.period_result')}</p>
                                <p className={`text-2xl font-black ${metrics.income - metrics.expense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(metrics.income - metrics.expense)}
                                </p>
                            </div>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 italic leading-relaxed">
                                {t('dashboard.quote_tip')}
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
                type={modalType}
                onDelete={handleDelete}
                onUpdate={handleQuickPayClick}
            />

            {/* Settle Modal for Quick Pay */}
            {selectedTransactionForSettle && (
                <SettleModal
                    isOpen={settleModalOpen}
                    onClose={() => {
                        setSettleModalOpen(false);
                        setSelectedTransactionForSettle(null);
                    }}
                    onConfirm={handleSettleConfirm}
                    transactionType={selectedTransactionForSettle.type}
                    transactionAmount={selectedTransactionForSettle.amount}
                    transactionDescription={selectedTransactionForSettle.description}
                    isVariableAmount={selectedTransactionForSettle.is_variable_amount}
                />
            )}

            {/* Premium Confirmation for Deletion */}
            <ConfirmationModal
                isOpen={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={() => executeDelete('single')}
                title={t('dashboard.confirm_delete_title')}
                message={t('common.confirm_delete') || 'Deseja realmente remover este lançamento? Esta ação não pode ser desfeita.'}
                variant="danger"
                confirmLabel={t('dashboard.confirm_delete_btn')}
                isLoading={isDeleting}
            />

            {/* Premium Choice for Recurrence */}
            <ChoiceModal
                isOpen={recurrenceChoiceOpen}
                onClose={() => setRecurrenceChoiceOpen(false)}
                title={t('dashboard.recurring_transaction_title')}
                description={t('dashboard.recurring_transaction_desc')}
                choices={[
                    { 
                        id: 'single', 
                        label: t('dashboard.choice_only_this'), 
                        description: t('dashboard.choice_only_this_desc'),
                        icon: <Trash2 size={18} />,
                        variant: 'danger'
                    },
                    { 
                        id: 'future', 
                        label: t('dashboard.choice_this_and_future'), 
                        description: t('dashboard.choice_this_and_future_desc'),
                        icon: <CalendarRange size={18} />,
                        variant: 'danger'
                    },
                    { 
                        id: 'all', 
                        label: t('dashboard.choice_all_series'), 
                        description: t('dashboard.choice_all_series_desc'),
                        icon: <ListChecks size={18} />,
                        variant: 'danger'
                    }
                ]}
                onSelect={(id) => executeDelete(id as any)}
            />

            {/* Result Reporting Modal */}
            <ResultModal
                isOpen={resultModal.isOpen}
                onClose={() => setResultModal(prev => ({ ...prev, isOpen: false }))}
                title={resultModal.title}
                message={resultModal.message}
                type={resultModal.type}
            />
        </div>
    );
}
