import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

export interface Service {
    id: string;
    name: string;
    description?: string;
    price: number;
    unit?: string;
    commission_rate?: number;
    show_in_pdf?: boolean;
    codigo_servico_municipal?: string;
    item_lista_servico?: string;
    user_id: string;
    company_id?: string;
}

export function useServices() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchServices = async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('services')
                .select('*')
                .order('name');

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setServices(data || []);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, [user, currentEntity]);

    const addService = async (service: Omit<Service, 'id' | 'user_id'>) => {
        if (!user) return;

        const company_id = currentEntity.type === 'company' ? currentEntity.id : null;

        const { error } = await supabase
            .from('services')
            .insert([{ ...service, user_id: user.id, company_id }]);

        if (error) throw error;
        await fetchServices();
    };

    const updateService = async (id: string, updates: Partial<Service>) => {
        const { error } = await supabase
            .from('services')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        await fetchServices();
    };

    const deleteService = async (id: string) => {
        const { error } = await supabase
            .from('services')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchServices();
    };

    return { services, loading, addService, updateService, deleteService, refresh: fetchServices };
}
