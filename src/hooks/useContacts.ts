import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { webhookService } from '../services/webhookService';

export interface Contact {
    id: string;
    name: string;
    type: 'client' | 'supplier' | 'both';
    entity_type: 'PF' | 'PJ';
    email?: string;
    phone?: string;
    whatsapp?: string;
    tax_id?: string;
    zip_code?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    birthday?: string | null;
    user_id: string;
    company_id?: string | null;
    loyalty_subscriptions?: {
        status: string;
        started_at?: string;
        next_due_at?: string;
        plan?: {
            name: string;
        };
    }[];
}

export function useContacts() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const runMigration = async (nullContacts: Contact[]) => {
        if (nullContacts.length === 0) return false;
        try {
            console.log('Running contacts company migration for', nullContacts.length, 'contacts...');
            
            // 1. Fetch transactions linking contacts to companies
            const { data: txs } = await supabase
                .from('transactions')
                .select('contact_id, company_id')
                .not('contact_id', 'is', null)
                .not('company_id', 'is', null);

            // 2. Fetch quotes linking contacts to companies
            const { data: quotes } = await supabase
                .from('quotes')
                .select('contact_id, company_id')
                .not('contact_id', 'is', null)
                .not('company_id', 'is', null);

            // 3. Fetch CRM deals linking contacts to companies
            const { data: deals } = await supabase
                .from('crm_deals')
                .select('contact_id, company_id')
                .not('contact_id', 'is', null)
                .not('company_id', 'is', null);

            const mapping: Record<string, string> = {};
            const addMappings = (list: any[] | null) => {
                if (!list) return;
                for (const item of list) {
                    if (item.contact_id && item.company_id) {
                        mapping[item.contact_id] = item.company_id;
                    }
                }
            };

            addMappings(txs);
            addMappings(quotes);
            addMappings(deals);

            const contactsToMigrate = nullContacts.filter(c => mapping[c.id]);
            if (contactsToMigrate.length > 0) {
                console.log(`Migrating ${contactsToMigrate.length} contacts to their respective companies...`);
                const promises = contactsToMigrate.map(c => 
                    supabase
                        .from('contacts')
                        .update({ company_id: mapping[c.id] })
                        .eq('id', c.id)
                );
                await Promise.all(promises);
                console.log('Migration completed.');
                return true;
            }
        } catch (err) {
            console.error('Error in contacts migration:', err);
        }
        return false;
    };

    const applyFilteredContacts = (list: Contact[]) => {
        if (currentEntity?.type === 'company' && currentEntity.id) {
            // Show contacts belonging to this company, or unassigned contacts (fallback)
            setContacts(list.filter(c => c.company_id === currentEntity.id || c.company_id === null));
        } else {
            // Personal context shows only unassigned contacts
            setContacts(list.filter(c => c.company_id === null));
        }
    };

    const fetchContacts = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('*, loyalty_subscriptions(status, started_at, next_due_at, plan:loyalty_plans(name))')
                .eq('user_id', user.id)
                .order('name');

            if (error) throw error;
            const allContacts = data || [];

            // Background migration for null contacts
            const nullContacts = allContacts.filter(c => c.company_id === null);
            if (nullContacts.length > 0) {
                const migrated = await runMigration(nullContacts);
                if (migrated) {
                    // Refetch contacts with new mappings
                    const { data: refreshedData, error: refreshedErr } = await supabase
                        .from('contacts')
                        .select('*, loyalty_subscriptions(status, started_at, next_due_at, plan:loyalty_plans(name))')
                        .eq('user_id', user.id)
                        .order('name');
                    if (!refreshedErr && refreshedData) {
                        applyFilteredContacts(refreshedData);
                        return;
                    }
                }
            }

            applyFilteredContacts(allContacts);
        } catch (error) {
            console.error('Error fetching contacts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, [user, currentEntity]);

    const addContact = async (contact: Omit<Contact, 'id' | 'user_id'>) => {
        if (!user) return;
        const company_id = contact.company_id !== undefined
            ? contact.company_id
            : (currentEntity?.type === 'company' ? currentEntity.id : null);

        const { data, error } = await supabase
            .from('contacts')
            .insert([{ ...contact, user_id: user.id, company_id }])
            .select()
            .single();

        if (error) throw error;
        await fetchContacts();

        // Trigger webhook for contact creation
        try {
            await webhookService.triggerWebhooks({
                eventType: 'CONTACT_CREATED',
                payload: data,
                userId: user.id
            });
        } catch (whError) {
            console.error('Error triggering CONTACT_CREATED webhook:', whError);
        }

        return data;
    };

    const updateContact = async (id: string, updates: Partial<Contact>) => {
        const company_id = updates.company_id !== undefined
            ? updates.company_id
            : (currentEntity?.type === 'company' ? currentEntity.id : null);

        const { data, error } = await supabase
            .from('contacts')
            .update({ ...updates, company_id })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        await fetchContacts();
        return data;
    };

    const deleteContact = async (id: string) => {
        const { error } = await supabase
            .from('contacts')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchContacts();
    };

    return { contacts, loading, addContact, updateContact, deleteContact, refresh: fetchContacts };
}
