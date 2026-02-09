import { useState, useMemo, useEffect } from 'react';
import { useTransactions } from '../hooks/useTransactions';
import { useCategories } from '../hooks/useCategories';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { PartyPopper, Wallet, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';

export function Reports() {
    const { transactions: expenses } = useTransactions('expense');
    const { transactions: income } = useTransactions('income');
    const { categories } = useCategories();

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
            const catName = categories.find(c => c.id === t.category_id)?.name || 'Sem Categoria';
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
            const catName = categories.find(c => c.id === t.category_id)?.name || 'Sem Categoria';
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
            let method = t.payment_method || 'Outros';
            if (method === 'credit_card') method = 'Cartão de Crédito';
            if (method === 'debit_card') method = 'Cartão de Débito';
            if (method === 'pix') method = 'Pix';
            if (method === 'cash') method = 'Dinheiro';
            if (method === 'transfer') method = 'Transferência';

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
            let method = t.payment_method || 'Outros';
            if (method === 'credit_card') method = 'Cartão de Crédito';
            if (method === 'debit_card') method = 'Cartão de Débito';
            if (method === 'pix') method = 'Pix';
            if (method === 'cash') method = 'Dinheiro';
            if (method === 'transfer') method = 'Transferência';
            if (method === 'boleto') method = 'Boleto';

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
            const catName = categories.find(c => c.id === t.category_id)?.name || 'Sem Categoria';
            const current = categoryMap.get(catName) || 0;
            categoryMap.set(catName, current + t.amount);
        });

        return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
    }, [expenses, startDate, endDate, categories]);

    const formatDateDisplay = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    const dateRangeDisplay = `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Relatórios e Análises</h1>

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

            {/* Summary Cards Row (Optional - Future) */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Despesas Realizadas */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Despesas Totais ({dateRangeDisplay})</h3>
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
                                    <RechartsTooltip formatter={(value: any) => [`R$ ${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Valor']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-3">
                                    <Wallet size={32} className="text-gray-400 dark:text-gray-500" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">Sem despesas</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Tudo calmo por aqui.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Despesas PENDENTES (New) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">Despesas Pendentes ({dateRangeDisplay})</h3>
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
                                    <RechartsTooltip formatter={(value: any) => [`R$ ${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Pendente']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full mb-3 animate-bounce">
                                    <PartyPopper size={32} className="text-green-600 dark:text-green-400" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">Tudo pago! 🎉</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma despesa pendente neste período.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Receitas */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Receitas ({dateRangeDisplay})</h3>
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
                                    <RechartsTooltip formatter={(value: any) => [`R$ ${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Valor']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-3">
                                    <TrendingUp size={32} className="text-gray-400 dark:text-gray-500" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">Sem receitas</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma venda registrada.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 2: Payment Methods */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Formas de Recebimento */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-green-600 dark:text-green-400">Formas de Recebimento ({dateRangeDisplay})</h3>
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
                                    <RechartsTooltip formatter={(value: any) => [`R$ ${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Valor']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-3">
                                    <PieChartIcon size={32} className="text-gray-400 dark:text-gray-500" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">Sem dados</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Não há registros de recebimento.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Formas de Pagamento (Despesas) */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                    <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">Formas de Pagamento (Despesas) ({dateRangeDisplay})</h3>
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
                                    <RechartsTooltip formatter={(value: any) => [`R$ ${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, 'Valor']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-full mb-3">
                                    <PieChartIcon size={32} className="text-gray-400 dark:text-gray-500" />
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white">Sem dados</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Não há registros de pagamento.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fluxo de Caixa */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Fluxo de Caixa ({startDate.split('-')[0]})</h3>
                <div className="h-64">
                    {isMounted && (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart
                                data={cashFlowData}
                                margin={{
                                    top: 5,
                                    right: 30,
                                    left: 20,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                                <RechartsTooltip
                                    formatter={(value: any) => [`R$ ${typeof value === 'number' ? value.toFixed(2) : '0.00'}`, '']}
                                    contentStyle={{ backgroundColor: 'var(--bg-content)', borderColor: 'var(--border-color)' }}
                                />
                                <Legend />
                                <Bar dataKey="ReceitasRealizadas" name="Recebido" stackId="revenue" fill="#10B981" />
                                <Bar dataKey="ReceitasPendentes" name="A Receber" stackId="revenue" fill="#6EE7B7" />
                                <Bar dataKey="DespesasPagas" name="Pago" stackId="expense" fill="#EF4444" />
                                <Bar dataKey="DespesasPendentes" name="A Pagar" stackId="expense" fill="#FCA5A5" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
