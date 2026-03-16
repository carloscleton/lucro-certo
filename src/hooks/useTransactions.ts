import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { calculateNextDates } from '../utils/dateUtils';
import { storageService } from '../lib/storageService';

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
    is_variable_amount: boolean;
    frequency?: 'weekly' | 'monthly' | 'yearly';
    recurrence_group_id?: string;
    installment_number?: number;
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
    deal_id?: string;
    contact?: { name: string };
    category?: { name: string };
    profile?: { full_name: string };
    notes?: string;
    created_at: string;
}

export function useTransactions(type: TransactionType) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchTransactions = useCallback(async () => {
        if (!user) return;

        if (transactions.length === 0) {
            setLoading(true);
        } else {
            setIsRefreshing(true);
        }

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
            setIsRefreshing(false);
        }
    }, [user, type, currentEntity]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const addTransaction = async (transaction: Omit<Transaction, 'id' | 'created_at' | 'user_id'>) => {
        if (!user) return;
        console.log('[useTransactions] addTransaction v1.1', transaction);
        try {
            const { overrides, propagate, is_recurring, frequency, recurring_count, ...rawData } = transaction as any;

            // Whitelist of columns actually in the database
            const dbSchema = [
                'description', 'amount', 'date', 'type', 'status', 'category_id',
                'company_id', 'contact_id', 'attachment_url', 'attachment_path',
                'payment_method', 'payment_date', 'interest', 'penalty',
                'paid_amount', 'quote_id', 'deal_id', 'is_variable_amount',
                'recurrence_group_id', 'installment_number', 'recurring_count', 'notes'
            ];

            const cleanTransaction: any = {};
            dbSchema.forEach(key => {
                if (rawData[key] !== undefined) cleanTransaction[key] = rawData[key];
            });

            const userId = user.id;
            const companyId = currentEntity.type === 'company' ? currentEntity.id : null;

            // If recurring, generate group and installments
            const recurrenceGroupId = is_recurring ? crypto.randomUUID() : null;

            const entriesToInsert = [{
                ...cleanTransaction,
                user_id: userId,
                company_id: companyId,
                recurrence_group_id: recurrenceGroupId,
                installment_number: is_recurring ? 1 : null,
                recurring_count: is_recurring ? recurring_count : null
            }];

            if (is_recurring && frequency) {
                const { exclusions } = transaction as any;
                const totalCountNum = (recurring_count && recurring_count > 1) ? recurring_count : 12;
                const nextDates = calculateNextDates(transaction.date, frequency, totalCountNum - 1);
                nextDates.forEach((dateObj, index) => {
                    const installmentIdx = index + 2;
                    if (exclusions?.includes(installmentIdx)) return;

                    const override = overrides?.[installmentIdx];

                    // IMPORTANT: Attachments and Notes are only for the FIRST (current) record
                    // Future recurring entries should be "clean"
                    const { attachment_url, attachment_path, notes, ...recurringBasics } = cleanTransaction;

                    entriesToInsert.push({
                        ...recurringBasics,
                        amount: override?.amount ?? cleanTransaction.amount,
                        date: override?.date ?? dateObj.toISOString().split('T')[0],
                        user_id: userId,
                        company_id: companyId,
                        recurrence_group_id: recurrenceGroupId,
                        installment_number: installmentIdx,
                        status: 'pending', // Future ones are always pending
                        recurring_count: totalCountNum
                    });
                });
            }

            const { data, error } = await supabase
                .from('transactions')
                .insert(entriesToInsert)
                .select();

            if (error) throw error;
            if (!data) throw new Error('Erro ao criar transação: Nenhum dado retornado.');

            // Only add the first one (or the one matching the current view) to local state if needed
            // Actually, better to just refresh to get all relevant ones for the current filter
            await fetchTransactions();
            return data[0];
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    const updateTransaction = async (id: string, updates: Partial<Transaction> & { propagate?: boolean }) => {
        console.log('[useTransactions] updateTransaction v1.1', updates);
        try {
            const { propagate, overrides, is_recurring, frequency, recurring_count, ...rawData } = updates as any;

            // Whitelist of columns actually in the database
            const dbSchema = [
                'description', 'amount', 'date', 'type', 'status', 'category_id',
                'company_id', 'contact_id', 'attachment_url', 'attachment_path',
                'payment_method', 'payment_date', 'interest', 'penalty',
                'paid_amount', 'quote_id', 'deal_id', 'is_variable_amount',
                'recurrence_group_id', 'installment_number', 'recurring_count', 'notes'
            ];

            const cleanUpdates: any = {};
            dbSchema.forEach(key => {
                if (rawData[key] !== undefined) cleanUpdates[key] = rawData[key];
            });

            // Find original transaction in local state to check for quote link or recurrence
            const originalTransaction = transactions.find(t => t.id === id);

            const { error, count } = await supabase
                .from('transactions')
                .update(cleanUpdates, { count: 'exact' })
                .eq('id', id);

            if (error) throw error;

            console.log(`Updated transaction ${id}. Rows affected: ${count}`);

            if (count === 0) {
                // Diagnose why
                console.warn('Update matched 0 rows. Probable causes: ID mismatch or RLS policy.');
                throw new Error("Falha na atualização: O registro não foi alterado. Verifique suas permissões.");
            }

            // Propagate to future ones if requested
            if (propagate && originalTransaction?.recurrence_group_id) {
                console.log(`📡 Propagating changes for group ${originalTransaction.recurrence_group_id}...`);

                // Fields to propagate (not everything from updates should be propagated)
                const propagationPayload: any = {};
                if (cleanUpdates.amount !== undefined) propagationPayload.amount = cleanUpdates.amount;
                if (cleanUpdates.description !== undefined) propagationPayload.description = cleanUpdates.description;
                if (cleanUpdates.category_id !== undefined) propagationPayload.category_id = cleanUpdates.category_id;
                if (cleanUpdates.company_id !== undefined) propagationPayload.company_id = cleanUpdates.company_id;
                if (cleanUpdates.contact_id !== undefined) propagationPayload.contact_id = cleanUpdates.contact_id;
                if (cleanUpdates.is_variable_amount !== undefined) propagationPayload.is_variable_amount = cleanUpdates.is_variable_amount;
                if (cleanUpdates.recurring_count !== undefined) propagationPayload.recurring_count = cleanUpdates.recurring_count;

                // Explicitly ensure we DON'T propagate attachments/notes to future ones if they were updated
                // as the user wants them only for the specific record.
                delete propagationPayload.attachment_url;
                delete propagationPayload.attachment_path;
                delete propagationPayload.notes;

                if (Object.keys(propagationPayload).length > 0) {
                    const { error: propError } = await supabase
                        .from('transactions')
                        .update(propagationPayload)
                        .eq('recurrence_group_id', originalTransaction.recurrence_group_id)
                        .eq('status', 'pending')
                        .gt('date', originalTransaction.date);

                    if (propError) {
                        console.error('Propagation error:', propError);
                        // We don't throw here to avoid failing the main update, but we log it
                    }
                }
            }

            // Individual Overrides (targeting specific installments by number)
            if (overrides && originalTransaction?.recurrence_group_id) {
                console.log(`🎯 Applying individual overrides for group ${originalTransaction.recurrence_group_id}...`);

                for (const [idxStr, override] of Object.entries(overrides)) {
                    const installmentNum = parseInt(idxStr);
                    const { amount: ovAmount, date: ovDate } = override as any;

                    const overridePayload: any = {};
                    if (ovAmount !== undefined) overridePayload.amount = ovAmount;
                    if (ovDate !== undefined) overridePayload.date = ovDate;

                    if (Object.keys(overridePayload).length > 0) {
                        const { error: overError } = await supabase
                            .from('transactions')
                            .update(overridePayload)
                            .eq('recurrence_group_id', originalTransaction.recurrence_group_id)
                            .eq('installment_number', installmentNum);

                        if (overError) {
                            console.error(`Error applying override to installment #${installmentNum}:`, overError);
                        }
                    }
                }
            }

            // Individual Exclusions (deleting specific installments)
            if ((updates as any).exclusions && originalTransaction?.recurrence_group_id) {
                console.log(`🗑️ Processing exclusions for group ${originalTransaction.recurrence_group_id}...`);
                const { error: exclError } = await supabase
                    .from('transactions')
                    .delete()
                    .eq('recurrence_group_id', originalTransaction.recurrence_group_id)
                    .in('installment_number', (updates as any).exclusions);

                if (exclError) {
                    console.error('Error processing exclusions:', exclError);
                }
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

    const deleteTransaction = async (id: string, scope: 'single' | 'future' | 'all' = 'single') => {
        try {
            // Get transaction details first to check status and quote link
            const { data: transaction } = await supabase
                .from('transactions')
                .select('quote_id, status, recurrence_group_id, date, attachment_path')
                .eq('id', id)
                .maybeSingle();

            // The UI (Transactions.tsx) now handles permission checks (admin/owner/member_can_delete)
            // before calling this function. We removed the hardcoded superadmin lock here.

            // NEW: Delete associated attachment from storage if it's not being used by other installments
            if (transaction?.attachment_path) {
                try {
                    // Check if this file is used by any OTHER transaction
                    const { count } = await supabase
                        .from('transactions')
                        .select('id', { count: 'exact', head: true })
                        .eq('attachment_path', transaction.attachment_path)
                        .neq('id', id);

                    // If scope is 'all', or 'future' (and it's the only one left after logic), or count is 0
                    // BUT for simplicity and safety, we delete if count is 0 (it shouldn't be yet) 
                    // OR if we are deleting 'all' records
                    if (scope === 'all' || (count === 0)) {
                        await storageService.delete('attachments', transaction.attachment_path);
                        console.log(`Deleted attachment via storageService: ${transaction.attachment_path}`);
                    } else if (scope === 'single' && count === 0) {
                        await storageService.delete('attachments', transaction.attachment_path);
                    }
                    // For 'future' or 'single' when others exist, we keep it to avoid breaking them.
                } catch (err) {
                    console.warn('Aviso: Falha ao gerenciar anexo no Storage', err);
                }
            }

            let query = supabase.from('transactions').delete();

            if (scope === 'single' || !transaction?.recurrence_group_id) {
                query = query.eq('id', id);
            } else if (scope === 'future') {
                query = query.eq('recurrence_group_id', transaction.recurrence_group_id)
                    .gte('date', transaction.date);
            } else if (scope === 'all') {
                query = query.eq('recurrence_group_id', transaction.recurrence_group_id);
            }

            const { error } = await query;

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

            if (scope === 'single' || !transaction?.recurrence_group_id) {
                setTransactions(prev => prev.filter(t => t.id !== id));
            } else {
                fetchTransactions(); // Refresh all if deleting multiple to keep state consistent
            }
        } catch (err: any) {
            setError(err.message);
            throw err;
        }
    };

    return {
        transactions,
        loading,
        isRefreshing,
        error,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        refresh: fetchTransactions
    };
}
