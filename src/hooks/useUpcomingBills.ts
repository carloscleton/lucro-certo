import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import type { Transaction } from './useTransactions';

export interface UpcomingBill extends Transaction {
    daysUntilDue: number;
    isOverdue: boolean;
    urgency: 'overdue' | 'thisWeek' | 'upcoming';
}

export interface UpcomingBillsSummary {
    overdue: UpcomingBill[];
    thisWeek: UpcomingBill[];
    upcoming: UpcomingBill[];
    totalExpenses: number;
    totalIncome: number;
    netBalance: number;
}

export function useUpcomingBills(days: number = 30) {
    const [bills, setBills] = useState<UpcomingBillsSummary>({
        overdue: [],
        thisWeek: [],
        upcoming: [],
        totalExpenses: 0,
        totalIncome: 0,
        netBalance: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchUpcomingBills = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);

        try {
            const today = new Date();
            const futureDate = new Date();
            futureDate.setDate(today.getDate() + days);

            const futureDateStr = futureDate.toISOString().split('T')[0];

            let query = supabase
                .from('transactions')
                .select('*, contact:contacts(name)')
                .eq('status', 'pending')
                .lte('date', futureDateStr)
                .order('date', { ascending: true });

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user.id).is('company_id', null);
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;

            const transactions = (data || []) as Transaction[];

            // Classify bills by urgency
            const overdue: UpcomingBill[] = [];
            const thisWeek: UpcomingBill[] = [];
            const upcoming: UpcomingBill[] = [];
            let totalExpenses = 0;
            let totalIncome = 0;

            transactions.forEach(transaction => {
                const dueDate = new Date(transaction.date);
                const diffTime = dueDate.getTime() - today.getTime();
                const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let urgency: 'overdue' | 'thisWeek' | 'upcoming';
                if (daysUntilDue < 0) {
                    urgency = 'overdue';
                } else if (daysUntilDue <= 7) {
                    urgency = 'thisWeek';
                } else {
                    urgency = 'upcoming';
                }

                const bill: UpcomingBill = {
                    ...transaction,
                    daysUntilDue,
                    isOverdue: daysUntilDue < 0,
                    urgency
                };

                if (urgency === 'overdue') {
                    overdue.push(bill);
                } else if (urgency === 'thisWeek') {
                    thisWeek.push(bill);
                } else {
                    upcoming.push(bill);
                }

                // Calculate totals
                const totalAmount = Number(transaction.amount) + Number(transaction.interest || 0) + Number(transaction.penalty || 0);
                if (transaction.type === 'expense') {
                    totalExpenses += totalAmount;
                } else {
                    totalIncome += totalAmount;
                }
            });

            setBills({
                overdue,
                thisWeek,
                upcoming,
                totalExpenses,
                totalIncome,
                netBalance: totalIncome - totalExpenses
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, days, currentEntity]);

    useEffect(() => {
        fetchUpcomingBills();
    }, [fetchUpcomingBills]);

    return {
        bills,
        loading,
        error,
        refresh: fetchUpcomingBills
    };
}
