import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransactions } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { PartyPopper, Wallet, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { formatDateString } from '../utils/dateUtils';
import { AnalyticalLedger } from '../components/reports/AnalyticalLedger';
import { TransactionForm } from '../components/transactions/TransactionForm';

export function Reports() {
    const { t: tr } = useTranslation();
    const { transactions: expenses, updateTransaction: updateExpense, deleteTransaction: deleteExpense } = useTransactions('expense');
    const { transactions: income, updateTransaction: updateIncome, deleteTransaction: deleteIncome } = useTransactions('income');
    const { categories } = useCategories();

    const [editingTransaction, setEditingTransaction] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleDelete = async (id: string) => {
        const transaction = [...expenses, ...income].find(t => t.id === id);
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
            if (!confirm(tr('common.confirm_delete'))) {
                return;
            }
        }

        try {
            if (transaction.type === 'expense') {
                await deleteExpense(id, scope);
            } else {
                await deleteIncome(id, scope);
            }
        } catch (error: any) {
            alert(error.message || tr('common.delete_error'));
        }
    };

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        // Silencia avisos específicos do Recharts que ocorrem antes do cálculo de dimensões
        const originalWarn = console.warn;
        console.warn = (...args) => {
            if (typeof args[0] === 'string' && args[0].includes('The width(-1) and height(-1) of chart should be greater than 0')) return;
            originalWarn(...args);
        };

        const timer = setTimeout(() => setIsMounted(true), 150);
        return () => {
            clearTimeout(timer);
            console.warn = originalWarn;
        };
    }, []);

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

    // Aggregate realized expenses by category
    const expenseData = useMemo(() => {
        const filteredExpenses = expenses.filter(t => isInRange(t.date) && t.status === 'paid');
        const categoryMap = new Map<string, number>();

        filteredExpenses.forEach(t => {
            const catName = categories.find(c => c.id === t.category_id)?.name || tr('reports.no_category');
            const current = categoryMap.get(catName) || 0;
            const amountToAdd = t.paid_amount || t.amount;
            categoryMap.set(catName, current + amountToAdd);
        });

        return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
    }, [expenses, startDate, endDate, categories]);

    // Aggregate income by category (Only received)
    const incomeData = useMemo(() => {
        const filteredIncome = income.filter(t => isInRange(t.date) && t.status === 'received');
        const categoryMap = new Map<string, number>();

        filteredIncome.forEach(t => {
            const catName = categories.find(c => c.id === t.category_id)?.name || tr('reports.no_category');
            const current = categoryMap.get(catName) || 0;
            const amountToAdd = t.paid_amount || t.amount;
            categoryMap.set(catName, current + amountToAdd);
        });

        return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
    }, [income, startDate, endDate, categories]);

    // Aggregate income by payment method (Only received)
    const incomePaymentMethodData = useMemo(() => {
        const filteredIncome = income.filter(t => isInRange(t.date) && t.status === 'received');
        const methodMap = new Map<string, number>();

        filteredIncome.forEach(t => {
            let method = t.payment_method || tr('reports.other');
            if (method === 'credit_card') method = tr('reports.credit_card');
            if (method === 'debit_card') method = tr('reports.debit_card');
            if (method === 'pix') method = tr('reports.pix');
            if (method === 'cash') method = tr('reports.cash');
            if (method === 'transfer') method = tr('reports.transfer');

            // Capitalize if it's a raw string
            method = method.charAt(0).toUpperCase() + method.slice(1);

            const current = methodMap.get(method) || 0;
            const amountToAdd = t.paid_amount || t.amount;
            methodMap.set(method, current + amountToAdd);
        });

        return Array.from(methodMap.entries()).map(([name, value]) => ({ name, value }));
    }, [income, startDate, endDate]);

    // Aggregate realized expense by payment method
    const expensePaymentMethodData = useMemo(() => {
        const filteredExpenses = expenses.filter(t => isInRange(t.date) && t.status === 'paid');
        const methodMap = new Map<string, number>();

        filteredExpenses.forEach(t => {
            let method = t.payment_method || tr('reports.other');
            if (method === 'credit_card') method = tr('reports.credit_card');
            if (method === 'debit_card') method = tr('reports.debit_card');
            if (method === 'pix') method = tr('reports.pix');
            if (method === 'cash') method = tr('reports.cash');
            if (method === 'transfer') method = tr('reports.transfer');
            if (method === 'boleto') method = tr('reports.boleto');

            // Capitalize if it's a raw string
            method = method.charAt(0).toUpperCase() + method.slice(1);

            const current = methodMap.get(method) || 0;
            const amountToAdd = t.paid_amount || t.amount;
            methodMap.set(method, current + amountToAdd);
        });

        return Array.from(methodMap.entries()).map(([name, value]) => ({ name, value }));
    }, [expenses, startDate, endDate]);

    // Aggregate monthly cash flow (selected year based on start date)
    const cashFlowData = useMemo(() => {
        const selectedYear = startDate.split('-')[0];
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        const data = months.map((month, index) => {
            const monthNum = (index + 1).toString().padStart(2, '0');
            const monthStr = `${selectedYear}-${monthNum}`;

            const monthIncomeReceived = income
                .filter(t => t.date.startsWith(monthStr) && t.status === 'received')
                .reduce((acc, t) => acc + (t.paid_amount || t.amount), 0);

            const monthIncomePending = income
                .filter(t => t.date.startsWith(monthStr) && t.status === 'pending')
                .reduce((acc, t) => acc + t.amount, 0);

            const monthExpensePaid = expenses
                .filter(t => t.date.startsWith(monthStr) && t.status === 'paid')
                .reduce((acc, t) => acc + (t.paid_amount || t.amount), 0);

            const monthExpensePending = expenses
                .filter(t => t.date.startsWith(monthStr) && (t.status === 'pending' || t.status === 'late'))
                .reduce((acc, t) => acc + t.amount, 0);

            return {
                name: month,
                ReceitasRealizadas: monthIncomeReceived,
                ReceitasPendentes: monthIncomePending,
                DespesasPagas: monthExpensePaid,
                DespesasPendentes: monthExpensePending
            };
        });

        return data;
    }, [expenses, income, startDate]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    // Aggregate PENDING expenses by category
    const expensePendingData = useMemo(() => {
        const filteredExpenses = expenses.filter(t =>
            isInRange(t.date) && (t.status === 'pending' || t.status === 'late')
        );
        const categoryMap = new Map<string, number>();

        filteredExpenses.forEach(t => {
            const catName = categories.find(c => c.id === t.category_id)?.name || tr('reports.no_category');
            const current = categoryMap.get(catName) || 0;
            categoryMap.set(catName, current + t.amount);
        });

        return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
    }, [expenses, startDate, endDate, categories]);

    const formatDateDisplay = (dateStr: string) => {
        return formatDateString(dateStr);
    };

    const dateRangeDisplay = `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{tr('reports.title')}</h1>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Month Picker Quick Select */}
                    <Tooltip content={tr('dashboard.quick_month_select')}>
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
                        <span className="text-gray-500">{tr('common.to')}</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            className="px-3 py-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards Row (Optional - Future) */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Despesas Realizadas */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">{tr('reports.total_expenses')} ({dateRangeDisplay})</h3>
                    <div className="h-64">
                        {isMounted && expenseData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={expenseData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expenseData.map((_entry, idx) => (
                                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: any) => [`\${window.__CURRENCY_SYMBOL__ || 'R$'} \${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Valor']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-3">
                                    <Wallet size={32} className="text-gray-400 dark:text-gray-500" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">{tr('reports.no_expenses')}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{tr('reports.all_calm')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Despesas PENDENTES (New) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">{tr('reports.pending_expenses')} ({dateRangeDisplay})</h3>
                    <div className="h-64">
                        {isMounted && expensePendingData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={expensePendingData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expensePendingData.map((_entry, idx) => (
                                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: any) => [`\${window.__CURRENCY_SYMBOL__ || 'R$'} \${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Pendente']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full mb-3 animate-bounce">
                                    <PartyPopper size={32} className="text-green-600 dark:text-green-400" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">{tr('reports.all_paid')}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{tr('reports.no_pending')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Receitas */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">{tr('reports.income')} ({dateRangeDisplay})</h3>
                    <div className="h-64">
                        {isMounted && incomeData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={incomeData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#10B981"
                                        dataKey="value"
                                    >
                                        {incomeData.map((_entry, idx) => (
                                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: any) => [`\${window.__CURRENCY_SYMBOL__ || 'R$'} \${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Valor']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-3">
                                    <TrendingUp size={32} className="text-gray-400 dark:text-gray-500" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">{tr('reports.no_income')}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{tr('reports.no_sales')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 2: Payment Methods */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Formas de Recebimento */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-green-600 dark:text-green-400">{tr('reports.payment_methods_income')} ({dateRangeDisplay})</h3>
                    <div className="h-64">
                        {isMounted && incomePaymentMethodData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={incomePaymentMethodData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {incomePaymentMethodData.map((_entry: any, idx: number) => (
                                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: any) => [`\${window.__CURRENCY_SYMBOL__ || 'R$'} \${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Valor']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-3">
                                    <PieChartIcon size={32} className="text-gray-400 dark:text-gray-500" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">{tr('reports.no_data')}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{tr('reports.no_receipts')}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Formas de Pagamento (Despesas) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">{tr('reports.payment_methods_expense')} ({dateRangeDisplay})</h3>
                    <div className="h-64">
                        {isMounted && expensePaymentMethodData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={expensePaymentMethodData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {expensePaymentMethodData.map((_entry: any, idx: number) => (
                                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: any) => [`\${window.__CURRENCY_SYMBOL__ || 'R$'} \${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Valor']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-3">
                                    <PieChartIcon size={32} className="text-gray-400 dark:text-gray-500" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">{tr('reports.no_data')}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{tr('reports.no_payments')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fluxo de Caixa */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-colors">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                    {tr('reports.cash_flow')} ({startDate.split('-')[0]})
                </h3>
                <div className="h-80">
                    {isMounted && (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart
                                data={cashFlowData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                                barGap={2}
                                barCategoryGap="20%"
                            >
                                <defs>
                                    <linearGradient id="rptReceivedGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                                        <stop offset="100%" stopColor="#34d399" stopOpacity={0.7} />
                                    </linearGradient>
                                    <linearGradient id="rptReceivableGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6ee7b7" stopOpacity={0.7} />
                                        <stop offset="100%" stopColor="#a7f3d0" stopOpacity={0.5} />
                                    </linearGradient>
                                    <linearGradient id="rptPaidGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                                        <stop offset="100%" stopColor="#f87171" stopOpacity={0.7} />
                                    </linearGradient>
                                    <linearGradient id="rptPayableGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#fca5a5" stopOpacity={0.7} />
                                        <stop offset="100%" stopColor="#fecaca" stopOpacity={0.5} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="currentColor"
                                    className="text-gray-100 dark:text-slate-700"
                                />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    dy={8}
                                    tick={{ fontSize: 12, fill: '#9ca3af' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                                    width={45}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                    content={({ active, payload, label }: any) => {
                                        if (!active || !payload?.length) return null;
                                        const received = payload.find((p: any) => p.dataKey === 'ReceitasRealizadas')?.value || 0;
                                        const receivable = payload.find((p: any) => p.dataKey === 'ReceitasPendentes')?.value || 0;
                                        const paid = payload.find((p: any) => p.dataKey === 'DespesasPagas')?.value || 0;
                                        const payable = payload.find((p: any) => p.dataKey === 'DespesasPendentes')?.value || 0;
                                        const balance = (received + receivable) - (paid + payable);
                                        const fmt = (v: number) => new Intl.NumberFormat(window.__CURRENCY_LOCALE__ || 'pt-BR', { style: 'currency', currency: window.__CURRENCY_CODE__ || 'BRL' }).format(v);

                                        return (
                                            <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 shadow-xl min-w-[200px]">
                                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{label}</p>
                                                <div className="space-y-1">
                                                    {received > 0 && (
                                                        <div className="flex justify-between gap-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                <span className="text-[11px] text-gray-600 dark:text-gray-300">{tr('reports.received')}</span>
                                                            </div>
                                                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{fmt(received)}</span>
                                                        </div>
                                                    )}
                                                    {receivable > 0 && (
                                                        <div className="flex justify-between gap-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-emerald-300" />
                                                                <span className="text-[11px] text-gray-600 dark:text-gray-300">{tr('reports.to_receive')}</span>
                                                            </div>
                                                            <span className="text-[11px] font-bold text-emerald-500">{fmt(receivable)}</span>
                                                        </div>
                                                    )}
                                                    {paid > 0 && (
                                                        <div className="flex justify-between gap-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                                                <span className="text-[11px] text-gray-600 dark:text-gray-300">{tr('reports.paid')}</span>
                                                            </div>
                                                            <span className="text-[11px] font-bold text-red-600 dark:text-red-400">{fmt(paid)}</span>
                                                        </div>
                                                    )}
                                                    {payable > 0 && (
                                                        <div className="flex justify-between gap-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-red-300" />
                                                                <span className="text-[11px] text-gray-600 dark:text-gray-300">{tr('reports.to_pay')}</span>
                                                            </div>
                                                            <span className="text-[11px] font-bold text-red-400">{fmt(payable)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="pt-1.5 mt-1.5 border-t border-gray-100 dark:border-slate-700 flex justify-between">
                                                    <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{tr('reports.balance')}</span>
                                                    <span className={`text-[11px] font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {fmt(balance)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Legend content={() => (
                                    <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }} />
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr('reports.received')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #6ee7b7, #a7f3d0)' }} />
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr('reports.to_receive')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #ef4444, #f87171)' }} />
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr('reports.paid')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #fca5a5, #fecaca)' }} />
                                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{tr('reports.to_pay')}</span>
                                        </div>
                                    </div>
                                )} />
                                <Bar dataKey="ReceitasRealizadas" name={tr('reports.received')} stackId="revenue" fill="url(#rptReceivedGrad)" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="ReceitasPendentes" name={tr('reports.to_receive')} stackId="revenue" fill="url(#rptReceivableGrad)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="DespesasPagas" name={tr('reports.paid')} stackId="expense" fill="url(#rptPaidGrad)" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="DespesasPendentes" name={tr('reports.to_pay')} stackId="expense" fill="url(#rptPayableGrad)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Razão Analítico (Consultas Detalhadas) */}
            <AnalyticalLedger
                startDate={startDate}
                endDate={endDate}
                onSelect={(transaction) => {
                    setEditingTransaction(transaction);
                    setIsModalOpen(true);
                }}
                onDelete={handleDelete}
            />

            <TransactionForm
                key={editingTransaction?.id || 'new-modal'}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingTransaction(null);
                }}
                type={editingTransaction?.type || 'expense'}
                initialData={editingTransaction}
                onSubmit={async (data) => {
                    if (editingTransaction?.type === 'expense') {
                        await updateExpense(editingTransaction.id, data);
                    } else if (editingTransaction?.type === 'income') {
                        await updateIncome(editingTransaction.id, data);
                    }
                    setIsModalOpen(false);
                    setEditingTransaction(null);
                }}
            />
        </div>
    );
}
