import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { webhookService } from '../services/webhookService';
import { storageService } from '../lib/storageService';

export interface QuoteItem {
    id?: string;
    quote_id?: string;
    service_id?: string | null;
    product_id?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    show_in_pdf?: boolean;
    ncm?: string;
    cest?: string;
    origem?: number;
    codigo_servico_municipal?: string;
    item_lista_servico?: string;
}

export interface Quote {
    id: string;
    user_id: string;
    company_id?: string | null;
    contact_id?: string;
    contact?: {
        name: string;
        email?: string;
        phone?: string;
        tax_id?: string;
        address?: {
            street: string;
            number: string;
            neighborhood?: string;
            city?: string;
            state?: string;
            zip_code?: string;
        }
    }; // Joined
    profile?: { full_name: string };
    title: string;
    quote_number?: string;
    status: 'draft' | 'sent' | 'approved' | 'rejected' | 'cancelled';
    payment_status?: 'pending' | 'paid' | 'none';
    total_amount: number;
    discount?: number;
    discount_type?: 'amount' | 'percentage';
    valid_until?: string;
    notes?: string;
    follow_up_date?: string | null;
    negotiation_notes?: string | null;
    created_at: string;
    items?: QuoteItem[];
    currency?: string;
    nfe_id?: string;
    nfe_status?: string;
    nfe_pdf_url?: string;
    nfe_xml_url?: string;
    nfe_error?: string;
    deal_id?: string | null;
}

export function useQuotes() {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchQuotes = useCallback(async () => {
        if (!user) return;

        if (quotes.length === 0) {
            setLoading(true);
        } else {
            setIsRefreshing(true);
        }

        try {
            let query = supabase
                .from('quotes')
                .select(`
                    *,
                    contact:contact_id ( 
                        name, 
                        email, 
                        tax_id, 
                        phone, 
                        zip_code, 
                        street, 
                        number, 
                        neighborhood, 
                        city, 
                        state 
                    )
                `)
                .order('created_at', { ascending: false });

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Transform flat contact data to nested address structure
            const formattedQuotes = (data as any[])?.map(quote => ({
                ...quote,
                contact: quote.contact ? {
                    name: quote.contact.name,
                    email: quote.contact.email,
                    tax_id: quote.contact.tax_id,
                    phone: quote.contact.phone,
                    address: {
                        street: quote.contact.street,
                        number: quote.contact.number,
                        zip_code: quote.contact.zip_code,
                        neighborhood: quote.contact.neighborhood,
                        city: quote.contact.city,
                        state: quote.contact.state
                    }
                } : undefined
            }));

            setQuotes(formattedQuotes || []);
        } catch (error) {
            console.error('Error fetching quotes:', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [user, currentEntity.id, quotes.length]);

    const scheduleFollowUp = useCallback(async (id: string, date: string, notes: string) => {
        try {
            const { error } = await supabase
                .from('quotes')
                .update({
                    follow_up_date: date,
                    negotiation_notes: notes
                })
                .eq('id', id);

            if (error) throw error;
            await fetchQuotes();
        } catch (error) {
            console.error('Error scheduling follow-up:', error);
            throw error;
        }
    }, [fetchQuotes]);

    useEffect(() => {
        fetchQuotes();
    }, [user, currentEntity.id]);

    const getQuote = useCallback(async (id: string) => {
        const { data: quote, error } = await supabase
            .from('quotes')
            .select(`
                *,
                contact:contact_id(*),
                items:quote_items(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error in getQuote:', error);
            throw error;
        }

        return quote as Quote;
    }, []);

    const createQuote = useCallback(async (quoteData: Partial<Quote>, items: QuoteItem[]) => {
        if (!user) return;

        // 1. Insert Quote
        const company_id = currentEntity.type === 'company' ? currentEntity.id : null;

        const { data: newQuote, error: quoteError } = await supabase
            .from('quotes')
            .insert([{ ...quoteData, user_id: user.id, company_id, deal_id: quoteData.deal_id }])
            .select()
            .single();

        if (quoteError) throw quoteError;

        // 2. Insert Items
        if (items.length > 0) {
            const itemsToInsert = items.map(item => ({
                ...item,
                quote_id: newQuote.id,
                total_price: item.quantity * item.unit_price,
                show_in_pdf: item.show_in_pdf !== undefined ? item.show_in_pdf : true
            }));

            const { error: itemsError } = await supabase
                .from('quote_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
        }

        await fetchQuotes();

        // Trigger webhook for quote creation
        try {
            await webhookService.triggerWebhooks({
                eventType: 'QUOTE_CREATED',
                payload: newQuote,
                companyId: currentEntity.type === 'company' ? currentEntity.id : undefined,
                userId: user.id
            });
        } catch (error) {
            console.error('Error triggering webhook:', error);
        }

        return newQuote;
    }, [user, currentEntity.id, fetchQuotes]);

    const updateQuoteStatus = useCallback(async (id: string, status: Quote['status']) => {
        const { error } = await supabase
            .from('quotes')
            .update({ status })
            .eq('id', id);

        if (error) throw error;
        await fetchQuotes();

        // Trigger Webhook if Rejected
        if (status === 'rejected') {
            try {
                // Fetch full quote details for webhook
                const { data: fullQuote } = await supabase
                    .from('quotes')
                    .select('*, items:quote_items(*), contact:contacts(*)')
                    .eq('id', id)
                    .single();

                if (fullQuote) {
                    console.log('❌ Triggering QUOTE_REJECTED webhook...');

                    const payload = {
                        quote: {
                            id: fullQuote.id,
                            title: fullQuote.title,
                            status: 'rejected',
                            total: fullQuote.total_amount,
                            subtotal: fullQuote.subtotal || fullQuote.total_amount, // fallback
                            discount: fullQuote.discount || 0,
                            discount_type: fullQuote.discount_type || 'amount',
                            valid_until: fullQuote.valid_until,
                            notes: fullQuote.notes || '',
                            created_at: fullQuote.created_at,
                            pdf_url: fullQuote.pdf_url
                        },
                        customer: fullQuote.contact ? {
                            id: fullQuote.contact.id,
                            name: fullQuote.contact.name,
                            email: fullQuote.contact.email,
                            phone: fullQuote.contact.phone
                        } : {},
                        items: fullQuote.items || [],
                        company: currentEntity.type === 'company' ? { id: currentEntity.id } : {}
                    };

                    await webhookService.triggerWebhooks({
                        eventType: 'QUOTE_REJECTED',
                        payload: payload,
                        companyId: currentEntity.type === 'company' ? currentEntity.id : undefined,
                        userId: user!.id
                    });
                }
            } catch (err) {
                console.error('Error triggering reject webhook:', err);
            }
        }
    }, [user, currentEntity.id, fetchQuotes]);

    const approveQuote = useCallback(async (id: string, options: {
        generateTransaction: boolean;
        transactionStatus?: 'pending' | 'received';
        paymentDetails?: {
            date: string;
            method?: string;
            interest?: number;
            penalty?: number;
            amount: number;
            notes?: string;
        }
    }) => {
        if (!user) return;

        const { generateTransaction, transactionStatus, paymentDetails } = options;

        // Determine Payment Status
        let paymentStatus: Quote['payment_status'] = 'none';
        if (generateTransaction) {
            paymentStatus = transactionStatus === 'received' ? 'paid' : 'pending';
        }

        // 1. Update Status and Payment Status
        const { error: updateError } = await supabase
            .from('quotes')
            .update({
                status: 'approved',
                payment_status: paymentStatus
            })
            .eq('id', id);

        if (updateError) {
            console.error('Error updating quote status:', updateError);
            throw updateError;
        }

        // CLUBE VIP RECOVERY Logic for Auto-Receive (generateTransaction: true && transactionStatus: 'received')
        if (paymentStatus === 'paid') {
            const { data: quoteItems } = await supabase.from('quote_items').select('description').eq('quote_id', id);
            if (quoteItems?.some(i => i.description?.includes('[Clube VIP] Regularização'))) {
                const quoteToUpdate = quotes.find(q => q.id === id);
                if (quoteToUpdate && quoteToUpdate.contact_id) {
                    // Set next due date to 30 days from today
                    const nextDate = new Date();
                    nextDate.setDate(nextDate.getDate() + 30);
                    const nextDateStr = nextDate.toISOString().split('T')[0];

                    await supabase
                        .from('loyalty_subscriptions')
                        .update({ 
                            status: 'active', 
                            canceled_at: null,
                            next_due_at: nextDateStr 
                        })
                        .eq('contact_id', quoteToUpdate.contact_id);
                    
                    console.log('Clube VIP reativado pelo approveQuote. Novo vencimento:', nextDateStr);
                }
            }
        }

        // 2. Generate Transaction
        if (generateTransaction) {
            const quote = quotes.find(q => q.id === id);
            if (!quote) return;

            // Check if transaction already exists for this quote
            const { data: existingTx } = await supabase
                .from('transactions')
                .select('id')
                .eq('quote_id', id)
                .eq('type', 'income')
                .maybeSingle();

            if (existingTx) {
                console.log('Transaction already exists for this quote, skipping creation');
            } else {
                const { error: txError } = await supabase
                    .from('transactions')
                    .insert([{
                        user_id: user.id,
                        description: `Ref. Orçamento: ${quote.title}`,
                        amount: paymentDetails?.amount || quote.total_amount,
                        type: 'income',
                        status: transactionStatus || 'pending',
                        date: paymentDetails?.date || new Date().toISOString().split('T')[0],
                        contact_id: quote.contact_id,
                        company_id: currentEntity.type === 'company' ? currentEntity.id : null,
                        payment_date: transactionStatus === 'received' ? paymentDetails?.date : null,
                        payment_method: paymentDetails?.method,
                        interest: paymentDetails?.interest,
                        penalty: paymentDetails?.penalty,
                        paid_amount: transactionStatus === 'received' ? paymentDetails?.amount : null,
                        notes: paymentDetails?.notes,
                        quote_id: quote.id, // Link the transaction to the quote
                        deal_id: quote.deal_id // Link the transaction to the deal if it exists
                    }]);

                if (txError) {
                    console.error('Erro ao gerar transação automática:', txError);
                    alert('Atenção: O orçamento foi aprovado e atualizado, mas houve um erro ao gerar a transação no financeiro.');
                }
            }
        }

        await fetchQuotes();

        // Trigger webhook for quote approval
        try {
            console.log('🎯 Triggering QUOTE_APPROVED webhook...');

            // Fetch complete quote data with items and contact
            const { data: fullQuote, error: quoteError } = await supabase
                .from('quotes')
                .select(`
                    *,
                    contact:contact_id(*),
                    items:quote_items(*)
                `)
                .eq('id', id)
                .single();

            if (quoteError) {
                console.error('Error fetching quote for webhook:', quoteError);
                throw quoteError;
            }

            if (fullQuote) {
                console.log('📦 Full quote data:', fullQuote);

                // Calculate totals
                const subtotal = fullQuote.items?.reduce((sum: number, item: any) =>
                    sum + item.total_price, 0) || 0;

                const discountAmount = fullQuote.discount_type === 'percentage'
                    ? (subtotal * (fullQuote.discount || 0)) / 100
                    : (fullQuote.discount || 0);

                const total = subtotal - discountAmount;

                const webhookPayload = {
                    quote: {
                        id: fullQuote.id,
                        quote_number: fullQuote.quote_number,
                        title: fullQuote.title,
                        status: 'approved',
                        payment_status: paymentStatus,
                        total,
                        subtotal,
                        discount: fullQuote.discount || 0,
                        discount_type: fullQuote.discount_type || 'amount',
                        valid_until: fullQuote.valid_until,
                        notes: fullQuote.notes,
                        created_at: fullQuote.created_at,
                        approved_at: new Date().toISOString()
                    },
                    customer: fullQuote.contact ? {
                        id: fullQuote.contact.id,
                        name: fullQuote.contact.name,
                        email: fullQuote.contact.email,
                        phone: fullQuote.contact.phone,
                        address: fullQuote.contact.address
                    } : null,
                    items: fullQuote.items || [],
                    payment_details: paymentDetails ? {
                        date: paymentDetails.date,
                        method: paymentDetails.method,
                        interest: paymentDetails.interest,
                        penalty: paymentDetails.penalty,
                        amount: paymentDetails.amount,
                        notes: paymentDetails.notes
                    } : null
                };

                console.log('📤 Sending webhook payload:', webhookPayload);

                await webhookService.triggerWebhooks({
                    eventType: 'QUOTE_APPROVED',
                    payload: webhookPayload,
                    companyId: currentEntity.type === 'company' ? currentEntity.id : undefined,
                    userId: user.id
                });

                console.log('✅ Webhook triggered successfully!');
            }
        } catch (error) {
            console.error('❌ Error triggering webhook:', error);
        }
    }, [user, currentEntity.id, quotes, fetchQuotes]);

    const updateQuote = useCallback(async (id: string, quoteData: Partial<Quote>, items: QuoteItem[]) => {
        if (!user) return;

        // 1. Update Quote Details
        const { error: quoteError } = await supabase
            .from('quotes')
            .update({ ...quoteData })
            .eq('id', id);

        if (quoteError) throw quoteError;

        // 2. Update Items (Strategy: Delete all and Re-insert)
        const { error: deleteError } = await supabase
            .from('quote_items')
            .delete()
            .eq('quote_id', id);

        if (deleteError) throw deleteError;

        if (items.length > 0) {
            const itemsToInsert = items.map(item => ({
                quote_id: id,
                service_id: item.service_id,
                product_id: item.product_id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.quantity * item.unit_price,
                show_in_pdf: item.show_in_pdf !== undefined ? item.show_in_pdf : true,
                ncm: item.ncm,
                cest: item.cest,
                origem: item.origem,
                codigo_servico_municipal: item.codigo_servico_municipal,
                item_lista_servico: item.item_lista_servico
            }));

            const { error: insertError } = await supabase
                .from('quote_items')
                .insert(itemsToInsert);

            if (insertError) throw insertError;
        }

        // 3. Sync Transaction (if exists)
        try {
            const { data: quote } = await supabase.from('quotes').select('status, total_amount, title').eq('id', id).single();

            if (quote && quote.status === 'approved') {
                const { data: tx } = await supabase.from('transactions').select('id, status, amount, paid_amount').eq('quote_id', id).eq('type', 'income').maybeSingle();

                if (tx) {
                    const updates: any = {
                        amount: quote.total_amount,
                        description: `Ref. Orçamento: ${quote.title}`
                    };

                    if (tx.status === 'received') {
                        updates.paid_amount = quote.total_amount;
                    }

                    await supabase
                        .from('transactions')
                        .update(updates)
                        .eq('id', tx.id);
                }
            }
        } catch (err) {
            console.error('Error syncing transaction:', err);
        }

        await fetchQuotes();
    }, [user, fetchQuotes]);

    const resetQuotePayment = useCallback(async (quoteId: string) => {
        try {
            // 1. Update Transaction back to pending
            const { error: txError } = await supabase
                .from('transactions')
                .update({
                    status: 'pending',
                    paid_amount: null,
                    payment_date: null,
                    payment_method: null,
                    interest: null,
                    penalty: null
                })
                .eq('quote_id', quoteId)
                .eq('type', 'income');

            if (txError) throw txError;

            // 2. Update Quote payment_status
            const { error: quoteError } = await supabase
                .from('quotes')
                .update({ payment_status: 'pending' })
                .eq('id', quoteId);

            if (quoteError) throw quoteError;

            await fetchQuotes();
            return { success: true };
        } catch (error: any) {
            console.error('Error resetting payment:', error);
            return { error: error.message };
        }
    }, [fetchQuotes]);

    const deleteQuote = useCallback(async (id: string) => {
        // Fetch quote to check status
        const quote = quotes.find(q => q.id === id);

        // 🔓 SUPER ADMIN: Bypass all protections
        const isSuperAdmin = user?.email === 'carloscleton.nat@gmail.com';

        if (!isSuperAdmin) {
            // 🔒 PROTECTION: Block deletion of approved/paid quotes (only for non-super-admins)
            if (quote && quote.status === 'approved' && (quote.payment_status === 'pending' || quote.payment_status === 'paid')) {
                throw new Error('❌ Não é possível excluir orçamentos aprovados com pagamento associado. Esta é uma medida de segurança para proteger dados financeiros.');
            }
        }

        // 0. Delete linked items
        const { error: itemsDeleteError } = await supabase
            .from('quote_items')
            .delete()
            .eq('quote_id', id);

        if (itemsDeleteError) {
            console.error('Error deleting quote items:', itemsDeleteError);
            throw new Error('Falha ao excluir itens do orçamento. Tente novamente.');
        }

        // 1. Delete linked transaction (if any)
        const { error: txError } = await supabase
            .from('transactions')
            .delete()
            .eq('quote_id', id);

        if (txError) {
            console.error('Error deleting linked transaction:', txError);
        }

        // 1.1 Delete linked company charges
        const { error: chargesError } = await supabase
            .from('company_charges')
            .delete()
            .eq('quote_id', id);

        if (chargesError) {
            console.error('Error deleting linked company charges:', chargesError);
        }

        // 2. Delete Quote PDFs from Storage
        try {
            const companyId = quote?.company_id || (currentEntity.type === 'company' ? currentEntity.id : 'personal');

            if (companyId) {
                const folder = `${companyId}/`;
                const files = await storageService.list('orcamento-quote-pdfs', folder);
                const filesToRemove = files
                    .filter(f => f.name.includes(id))
                    .map(f => `${folder}${f.name}`);

                if (filesToRemove.length > 0) {
                    await storageService.deleteMultiple('orcamento-quote-pdfs', filesToRemove);
                }
            }
        } catch (storageErr) {
            console.error('Error in storage cleanup:', storageErr);
        }

        // 3. Delete Quote
        const { error } = await supabase
            .from('quotes')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchQuotes();
    }, [user, quotes, currentEntity.id, fetchQuotes]);

    return { quotes, loading, isRefreshing, getQuote, createQuote, updateQuote, updateQuoteStatus, approveQuote, deleteQuote, resetQuotePayment, scheduleFollowUp, refresh: fetchQuotes };
}
