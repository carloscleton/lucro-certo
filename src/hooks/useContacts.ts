import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';
import { webhookService } from '../services/webhookService';

export interface Contact {
    id: string;
    name: string;
    type: 'client' | 'supplier';
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

    const fetchContacts = async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('contacts')
                .select('*, loyalty_subscriptions(status, started_at, next_due_at, plan:loyalty_plans(name))')
                .order('name');

            if (currentEntity?.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setContacts(data || []);
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
        const { data, error } = await supabase
            .from('contacts')
            .update(updates)
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
