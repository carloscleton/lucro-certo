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
            const scope = currentEntity.type === 'company' ? 'business' : 'personal';
            let query = supabase
                .from('categories')
                .select('*')
                .eq('scope', scope)
                .order('name');

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
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

        // Override scope based on current context
        const scope = currentEntity.type === 'company' ? 'business' : 'personal';
        const company_id = currentEntity.type === 'company' ? currentEntity.id : null;

        const { error } = await supabase
            .from('categories')
            .insert([{ ...category, user_id: user.id, scope, company_id }]);

        if (error) throw error;
        await fetchCategories();
    };

    const updateCategory = async (id: string, updates: Partial<Category>) => {
        const { error } = await supabase
            .from('categories')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        await fetchCategories();
    };

    const deleteCategory = async (id: string) => {
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
