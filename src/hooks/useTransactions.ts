import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

export type TransactionType = 'expense' | 'income';
export type TransactionStatus = 'pending' | 'paid' | 'received' | 'late';

export interface Transaction {
    id: string;
    user_id: string;
    description: string;
    amount: number;
    date: string;
    type: TransactionType;
    status: TransactionStatus;
    category_id?: string;
    company_id?: string;
    is_recurring: boolean;
    frequency?: 'weekly' | 'monthly' | 'yearly';
    parent_id?: string;
    contact_id?: string;
    attachment_url?: string;
    attachment_path?: string;
    payment_method?: string;
    payment_date?: string | null;
    interest?: number;
    penalty?: number;
    paid_amount?: number;
    origin?: string; // for income
    quote_id?: string;
    contact?: { name: string };
    profile?: { full_name: string };
    created_at: string;
}

export function useTransactions(type: TransactionType) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchTransactions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null); // Reset error on new fetch
        try {
            let query = supabase
                .from('transactions')
                .select('*, contact:contacts(name)')
                .eq('type', type)
                .order('date', { ascending: true });

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setTransactions(data || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, type, currentEntity]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at' | 'user_id'>) => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('transactions')
                .insert([{
                    ...transaction,
                    user_id: user.id,
                    company_id: currentEntity.type === 'company' ? currentEntity.id : null
                }])
                .select()
                .maybeSingle();

            if (error) throw error;
            if (!data) throw new Error('Erro ao criar transação: Nenhum dado retornado.');

            setTransactions(prev => [...prev, data]);
            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
        try {
            // Find original transaction in local state to check for quote link
            const originalTransaction = transactions.find(t => t.id === id);

            const { error, count } = await supabase
                .from('transactions')
                .update(updates, { count: 'exact' })
                .eq('id', id);

            if (error) throw error;

            console.log(`Updated transaction ${id}. Rows affected: ${count}`);

            if (count === 0) {
                // Diagnose why
                console.warn('Update matched 0 rows. Probable causes: ID mismatch or RLS policy.');
                throw new Error("Falha na atualização: O registro não foi alterado. Verifique suas permissões.");
            }

            // Sync Quote Payment Status if needed
            if (updates.status && originalTransaction?.quote_id) {
                const isPaid = updates.status === 'paid' || updates.status === 'received';
                const paymentStatus = isPaid ? 'paid' : 'pending';

                await supabase
                    .from('quotes')
                    .update({ payment_status: paymentStatus })
                    .eq('id', originalTransaction.quote_id);
            }

            await fetchTransactions();
        } catch (err: any) {
            console.error('Error updating transaction:', err);
            setError(err.message);
            throw err;
        }
    };

    const deleteTransaction = async (id: string) => {
        try {
            // Get transaction details first to check status and quote link
            const { data: transaction } = await supabase
                .from('transactions')
                .select('quote_id, status')
                .eq('id', id)
                .maybeSingle();

            // 🔓 SUPER ADMIN: Bypass all protections
            const isSuperAdmin = user?.email === 'carloscleton.nat@gmail.com';

            if (!isSuperAdmin) {
                // 🔒 PROTECTION: Block deletion of paid/received transactions
                if (transaction && (transaction.status === 'paid' || transaction.status === 'received')) {
                    throw new Error('🔒 Não é possível excluir transações pagas ou recebidas. Esta é uma medida de segurança para proteger dados financeiros.\n\nSe necessário, um administrador pode criar um estorno.');
                }
            }

            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // If linked to a quote, update quote payment status
            if (transaction?.quote_id) {
                await supabase
                    .from('quotes')
                    .update({
                        payment_status: 'none'
                        // Optional: revert to 'approved' or keep as is? 
                        // Keeping 'approved' but clearing payment status is safe.
                    })
                    .eq('id', transaction.quote_id);
            }

            setTransactions(prev => prev.filter(t => t.id !== id));
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    return {
        transactions,
        loading,
        error,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        refresh: fetchTransactions
    };
}
