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

export function Dashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { deleteTransaction: deleteExpense } = useTransactions('expense');
    const { deleteTransaction: deleteIncome } = useTransactions('income');

    const handleDelete = async (id: string) => {
        const transaction = transactions.find(t => t.id === id);
        if (!transaction) return;

        let scope: 'single' | 'future' | 'all' = 'single';

        if (transaction.recurrence_group_id) {
            const choice = window.prompt(
                'Lançamento Recorrente detectado. O que deseja apagar?\n\n' +
                '1 - APENAS este Lançamento\n' +
                '2 - Este e os FUTUROS (A partir desta data)\n' +
                '3 - TODOS (Histórico completo desta repetição)\n\n' +
                'Digite o número da opção desejada:'
            );

            if (choice === null) return; // Cancelled

            if (choice === '2') {
                scope = 'future';
            } else if (choice === '3') {
                scope = 'all';
            } else if (choice !== '1') {
                alert('Opção inválida. Operação cancelada.');
                return;
            }
        } else {
            if (!confirm(t('common.confirm_delete'))) {
                return;
            }
        }

        try {
            if (transaction.type === 'expense') {
                await deleteExpense(id, scope);
            } else {
                await deleteIncome(id, scope);
            }
            refreshDashboard();
        } catch (error: any) {
            alert(error.message || t('common.delete_error'));
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
        <div className="flex flex-col gap-6">
            {isAdmin && adminStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm group hover:border-blue-200 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Usuários</span>
                            <Users size={14} className="text-blue-500" />
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{adminStats.total_users}</div>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">Plataforma Global</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm group hover:border-purple-200 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Empresas</span>
                            <Building size={14} className="text-purple-500" />
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{adminStats.total_companies}</div>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">Contas corporativas</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm group hover:border-emerald-200 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Comissões</span>
                            <DollarSign size={14} className="text-emerald-500" />
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(adminStats.total_commission || 0)}
                        </div>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">Líquido estimado</div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm group hover:border-blue-300 transition-all">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Volume</span>
                            <TrendingUp size={14} className="text-blue-600" />
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(adminStats.total_revenue || 0)}
                        </div>
                        <div className="text-[9px] text-gray-400 dark:text-slate-500 mt-1">Total processado</div>
                    </div>
                </div>
            )}


            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{greeting}, {firstName}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{t('dashboard.financial_summary')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Month Picker Quick Select */}
                    <Tooltip content={t('dashboard.quick_month_select')}>
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
                        <span className="text-gray-500">{t('common.to')}</span>
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
                    {/* Side Column Widgets */}
                    <div className="space-y-6">
                        <AgendaTasksWidget tasks={agendaTasks} />

                        {isCRMEnabled && (
                            <CRMStatsWidget receivedIncome={metrics.income} />
                        )}

                        {isLoyaltyEnabled && (
                            <LoyaltyStatsWidget />
                        )}
                    </div>

                    {/* Cash Flow Forecast */}
                    <CashFlowForecast
                        currentBalance={metrics.balance}
                        monthlyIncome={metrics.income}
                        monthlyExpense={metrics.expense}
                        pendingReceivable={metrics.totalReceivable}
                        pendingPayable={metrics.totalPayable}
                    />

                    {/* Upcoming Bills Widget */}
                    <UpcomingBillsWidget onRefreshMetrics={refreshDashboard} />

                    {/* Quick Summary Card */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{t('dashboard.quick_summary')}</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                                <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.period_result')}</p>
                                <p className={`text-xl font-bold ${metrics.income - metrics.expense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(metrics.income - metrics.expense)}
                                </p>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
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
            />

        </div>
    );
}
