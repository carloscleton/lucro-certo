import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { format } from 'date-fns';

export interface DashboardMetrics {
    balance: number;
    totalPayable: number; // Pending
    totalReceivable: number; // Pending
    income: number; // Paid
    expense: number; // Paid
    rejectedTotal: number; // All rejected (potential recovery)
    rejectedCount: number;
}

export interface ChartData {
    name: string;
    income: number;
    expense: number;
}

export interface Alert {
    id: string;
    description: string;
    date: string;
    amount: number;
    type: 'overdue' | 'due_soon' | 'recovery_due';
    category_name?: string;
}

export function useDashboard(startDate: string, endDate: string) {
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        balance: 0,
        totalPayable: 0,
        totalReceivable: 0,
        income: 0,
        expense: 0,
        rejectedTotal: 0,
        rejectedCount: 0,
    });
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [expensesByCategory, setExpensesByCategory] = useState<{ category_id: string; amount: number }[]>([]);
    const [pendingList, setPendingList] = useState<any[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchMetrics = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const start = startDate;
        const end = endDate;
        const today = new Date().toISOString().split('T')[0];
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        const dueLimit = threeDaysFromNow.toISOString().split('T')[0];

        try {
            // Fetch Transactions
            let txQuery = supabase.from('transactions').select('*, category:categories(name)');

            // Fetch Quotes
            let quotesQuery = supabase.from('quotes').select('id, title, total_amount, status, created_at, follow_up_date, negotiation_notes');

            if (currentEntity.type === 'company' && currentEntity.id) {
                txQuery = txQuery.eq('company_id', currentEntity.id);
                quotesQuery = quotesQuery.eq('company_id', currentEntity.id);
            } else {
                txQuery = txQuery.eq('user_id', user.id).is('company_id', null);
                quotesQuery = quotesQuery.eq('user_id', user.id).is('company_id', null);
            }

            const [txRes, quotesRes] = await Promise.all([txQuery, quotesQuery]);

            if (txRes.error) throw txRes.error;
            if (quotesRes.error) throw quotesRes.error;

            const transactions = txRes.data || [];
            const quotes = quotesRes.data || [];

            setTransactions(transactions);

            // Metrics for the SELECTED PERIOD
            const currentPeriodTx = transactions.filter(t => t.date >= start && t.date <= end);

            const income = currentPeriodTx
                .filter(t => t.type === 'income' && t.status === 'received')
                .reduce((acc, t) => acc + Number(t.paid_amount || t.amount), 0);

            const expense = currentPeriodTx
                .filter(t => t.type === 'expense' && t.status === 'paid')
                .reduce((acc, t) => acc + Number(t.paid_amount || t.amount), 0);

            const globalPayable = transactions
                .filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'late'))
                .reduce((acc, t) => acc + Number(t.amount), 0);

            const globalReceivable = transactions
                .filter(t => t.type === 'income' && t.status === 'pending')
                .reduce((acc, t) => acc + Number(t.amount), 0);

            // Rejected Quotes (Potential Recovery)
            const rejectedQuotes = quotes.filter(q => q.status === 'rejected');
            console.log('📊 Quotes Stats:', {
                total: quotes.length,
                rejected: rejectedQuotes.length
            });

            const rejectedTotal = rejectedQuotes.reduce((acc, q) => {
                let val = q.total_amount;
                if (typeof val === 'string') {
                    val = (val as string).replace(/[^\d,-]/g, '').replace(',', '.');
                }
                const num = Number(val);
                const safeNum = isNaN(num) ? 0 : num;
                return acc + safeNum;
            }, 0);

            const rejectedCount = rejectedQuotes.length;

            // Balance = Period Result (Income - Expense for selected period)
            const periodBalance = income - expense;

            setMetrics({
                balance: periodBalance,
                totalPayable: globalPayable,
                totalReceivable: globalReceivable,
                income,
                expense,
                rejectedTotal,
                rejectedCount
            });

            // Chart Data
            const incomeData = transactions
                .filter(t => t.type === 'income' && t.status === 'received' && t.date >= start && t.date <= end);
            const expenseData = transactions
                .filter(t => t.type === 'expense' && t.status === 'paid' && t.date >= start && t.date <= end);

            const daysMap = new Map<string, { income: 0, expense: 0 }>();
            let curr = new Date(start);
            const endD = new Date(end);
            while (curr <= endD) {
                daysMap.set(curr.toISOString().split('T')[0], { income: 0, expense: 0 });
                curr.setDate(curr.getDate() + 1);
            }

            incomeData.forEach(t => {
                if (daysMap.has(t.date)) daysMap.get(t.date)!.income += Number(t.paid_amount || t.amount);
            });
            expenseData.forEach(t => {
                if (daysMap.has(t.date)) daysMap.get(t.date)!.expense += Number(t.paid_amount || t.amount);
            });

            const chart = Array.from(daysMap.entries()).map(([date, val]) => ({
                name: format(new Date(date), 'dd/MM'),
                income: val.income,
                expense: val.expense
            }));
            setChartData(chart);

            // Alerts Logic
            const newAlerts: Alert[] = [];
            // Check Overdue
            console.log("Processing Alerts...");
            const globalPayableList = transactions.filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'late'));

            globalPayableList
                .filter(t => t.date < today)
                .forEach(t => newAlerts.push({
                    id: t.id,
                    description: t.description,
                    date: t.date,
                    amount: t.amount,
                    type: 'overdue',
                    category_name: t.category?.name
                }));

            // Check Due Soon
            globalPayableList
                .filter(t => t.date >= today && t.date <= dueLimit)
                .forEach(t => newAlerts.push({
                    id: t.id,
                    description: t.description,
                    date: t.date,
                    amount: t.amount,
                    type: 'due_soon',
                    category_name: t.category?.name
                }));

            // RECOVERY ALERTS
            // Find rejected quotes with follow_up_date <= today
            rejectedQuotes.forEach(q => {
                if (q.follow_up_date) {
                    const followUp = q.follow_up_date;
                    // If today is equal or past the follow-up date
                    if (today >= followUp) {
                        newAlerts.push({
                            id: q.id,
                            description: `Retorno: ${q.title} (${q.negotiation_notes || 'Sem notas'})`,
                            date: followUp,
                            amount: q.total_amount,
                            type: 'recovery_due'
                        });
                    }
                }
            });

            setAlerts(newAlerts);

            // Expenses by Category (Period)
            const expenses = currentPeriodTx.filter(t => t.type === 'expense' && t.status === 'paid');
            const expensesMap = new Map<string, number>();

            expenses.forEach(t => {
                const catId = t.category_id || 'uncategorized';
                const amount = Number(t.paid_amount || t.amount);
                expensesMap.set(catId, (expensesMap.get(catId) || 0) + amount);
            });

            const expenseByCat = Array.from(expensesMap.entries()).map(([category_id, amount]) => ({
                category_id,
                amount
            })).sort((a, b) => b.amount - a.amount);

            setExpensesByCategory(expenseByCat);

            // Pending List (Selected Period)
            const pending = currentPeriodTx
                .filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'late'))
                .sort((a, b) => a.date.localeCompare(b.date));
            setPendingList(pending);

        } catch (err) {
            console.error("Dashboard Error:", err);
        } finally {
            setLoading(false);
        }
    }, [user, currentEntity.id, startDate, endDate]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    return {
        metrics,
        chartData,
        alerts,
        expensesByCategory,
        pendingList,
        transactions,
        loading,
        refresh: fetchMetrics
    };
}
