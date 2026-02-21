import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

export interface Category {
    id: string;
    name: string;
    type: 'expense' | 'income';
    scope: 'personal' | 'business';
    user_id: string;
    company_id?: string | null;
    budget_limit?: number | null;
    entity_type?: 'individual' | 'company';
}

export function useCategories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchCategories = async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('categories')
                .select('id, name, type, scope, user_id, company_id, budget_limit, entity_type')
                .order('name');

            if (currentEntity.type === 'company' && currentEntity.id) {
                // For companies, prioritize company_id association
                query = query.eq('company_id', currentEntity.id);
            } else {
                // For personal, show records with NULL company_id belonging to the user
                query = query.eq('user_id', user.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setCategories(data || []);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [user, currentEntity]);

    const addCategory = async (category: Omit<Category, 'id' | 'user_id'>) => {
        if (!user) return;

        // Use provided scope/company_id or fallback to current context
        const scope = category.scope ?? (currentEntity.type === 'company' ? 'business' : 'personal');
        const company_id = category.company_id !== undefined ? category.company_id : (currentEntity.type === 'company' ? currentEntity.id : null);

        const { error } = await supabase
            .from('categories')
            .insert([{ ...category, user_id: user.id, scope, company_id }]);

        if (error) throw error;
        await fetchCategories();
    };

    const updateCategory = async (id: string, updates: Partial<Category>) => {
        console.log('UPDATING CATEGORY:', id, updates);
        const { data, error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('UPDATE ERROR:', error);
            throw error;
        }
        console.log('UPDATE SUCCESS:', data);
        await fetchCategories();
    };

    const deleteCategory = async (id: string) => {
        // Primeiro, verifica se a categoria está em uso nas transações
        const { count, error: countError } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', id);

        if (countError) throw countError;

        if (count && count > 0) {
            throw new Error(`Esta categoria não pode ser excluída pois está vinculada a ${count} transaç${count === 1 ? 'ão' : 'ões'}.`);
        }

        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchCategories();
    };

    const duplicateCategory = async (category: Category) => {
        if (!user) return;

        // Determine target scope (clone TO the other scope)
        const targetScope = category.scope === 'personal' ? 'business' : 'personal';
        const targetLabel = targetScope === 'personal' ? 'Pessoal' : 'Empresarial';

        // Check if category already exists in target scope to prevent simple dupes (optional but good)
        // For now, just insert.

        const { error } = await supabase
            .from('categories')
            .insert([{
                name: category.name,
                type: category.type,
                user_id: user.id,
                scope: targetScope,
                entity_type: category.entity_type
            }]);

        if (error) throw error;

        // We don't need to refresh because it's in the other scope
        return targetLabel;
    };

    return { categories, loading, addCategory, updateCategory, deleteCategory, duplicateCategory, refresh: fetchCategories };
}
