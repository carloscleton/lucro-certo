import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

export interface Product {
    id: string;
    name: string;
    description?: string;
    sub_description?: string;
    price: number;
    unit?: string;
    commission_rate?: number;
    show_in_pdf?: boolean;
    ncm?: string;
    cest?: string;
    origem?: number;
    preco_custo?: number;
    user_id: string;
    company_id?: string;
}

export function useProducts() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchProducts = async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('products')
                .select('*')
                .order('name');

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [user, currentEntity]);

    const addProduct = async (product: Omit<Product, 'id' | 'user_id'>) => {
        if (!user) return;

        const company_id = currentEntity.type === 'company' ? currentEntity.id : null;

        const { error } = await supabase
            .from('products')
            .insert([{ ...product, user_id: user.id, company_id }]);

        if (error) throw error;
        await fetchProducts();
    };

    const updateProduct = async (id: string, updates: Partial<Product>) => {
        const { error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        await fetchProducts();
    };

    const deleteProduct = async (id: string) => {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchProducts();
    };

    return { products, loading, addProduct, updateProduct, deleteProduct, refresh: fetchProducts };
}
