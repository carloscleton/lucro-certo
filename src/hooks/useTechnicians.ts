import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';
import { useAuth } from '../context/AuthContext';

export interface Technician {
    id: string;
    company_id: string;
    name: string;
    specialty?: string;
    phone?: string;
    status: 'active' | 'inactive';
    created_at: string;
}

export function useTechnicians() {
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { currentEntity } = useEntity();
    const { user } = useAuth();

    const fetchTechnicians = useCallback(async () => {
        if (!user || currentEntity.type !== 'company' || !currentEntity.id) {
            setTechnicians([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('company_technicians')
                .select('*')
                .eq('company_id', currentEntity.id)
                .order('name');

            if (error) throw error;
            setTechnicians(data || []);
        } catch (err: any) {
            console.error('Error fetching technicians:', err);
            setError(err.message || 'Erro ao carregar técnicos');
        } finally {
            setLoading(false);
        }
    }, [user, currentEntity.id, currentEntity.type]);

    useEffect(() => {
        fetchTechnicians();
    }, [fetchTechnicians]);

    const addTechnician = async (name: string, specialty?: string, phone?: string) => {
        if (currentEntity.type !== 'company' || !currentEntity.id) {
            return { error: 'Not in company context' };
        }

        try {
            const { data, error } = await supabase
                .from('company_technicians')
                .insert([{
                    company_id: currentEntity.id,
                    name,
                    specialty,
                    phone,
                    status: 'active'
                }])
                .select()
                .single();

            if (error) throw error;
            setTechnicians(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
            return { data, error: null };
        } catch (err: any) {
            console.error('Error adding technician:', err);
            return { data: null, error: err.message || 'Erro ao cadastrar técnico' };
        }
    };

    const updateTechnician = async (id: string, updates: Partial<Omit<Technician, 'id' | 'company_id' | 'created_at'>>) => {
        try {
            const { data, error } = await supabase
                .from('company_technicians')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            setTechnicians(prev => prev.map(t => t.id === id ? data : t).sort((a, b) => a.name.localeCompare(b.name)));
            return { data, error: null };
        } catch (err: any) {
            console.error('Error updating technician:', err);
            return { data: null, error: err.message || 'Erro ao atualizar técnico' };
        }
    };

    const deleteTechnician = async (id: string) => {
        try {
            const { error } = await supabase
                .from('company_technicians')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setTechnicians(prev => prev.filter(t => t.id !== id));
            return { error: null };
        } catch (err: any) {
            console.error('Error deleting technician:', err);
            return { error: err.message || 'Erro ao excluir técnico' };
        }
    };

    return {
        technicians,
        loading,
        error,
        addTechnician,
        updateTechnician,
        deleteTechnician,
        refresh: fetchTechnicians
    };
}
