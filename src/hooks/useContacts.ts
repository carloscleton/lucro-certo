import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface Contact {
    id: string;
    name: string;
    type: 'client' | 'supplier';
    email?: string;
    phone?: string;
    tax_id?: string;
    zip_code?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    user_id: string;
}

export function useContacts() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchContacts = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select('*')
                .order('name');

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
    }, [user]);

    const addContact = async (contact: Omit<Contact, 'id' | 'user_id'>) => {
        if (!user) return;
        const { data, error } = await supabase
            .from('contacts')
            .insert([{ ...contact, user_id: user.id }])
            .select()
            .single();

        if (error) throw error;
        await fetchContacts();
        return data;
    };

    const updateContact = async (id: string, updates: Partial<Contact>) => {
        const { error } = await supabase
            .from('contacts')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        await fetchContacts();
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
