import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useEntity } from '../context/EntityContext';

export interface LoyaltyPlan {
    id: string;
    company_id: string;
    name: string;
    description: string;
    price: number;
    discount_percent: number;
    included_services: string[];
    billing_cycle: 'monthly' | 'yearly';
    is_active: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
}

export interface LoyaltySettings {
    id: string;
    company_id: string;
    enabled: boolean;
    platform_fee_percent: number;
    trial_days: number;
    trial_started_at?: string;
    gateway_type: 'asaas' | 'mercadopago';
    gateway_api_key?: string;
    due_day: number;
    grace_days: number;
    alert_on_checkin: boolean;
    internal_notes?: string;
}

export function useLoyalty() {
    const { currentEntity } = useEntity();
    const [plans, setPlans] = useState<LoyaltyPlan[]>([]);
    const [settings, setSettings] = useState<LoyaltySettings | null>(null);
    const [stats, setStats] = useState({ activeSubscribers: 0, mrr: 0, overdueCount: 0 });
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        if (!currentEntity.id || currentEntity.type !== 'company') return;
        try {
            const { data: subs, error } = await supabase
                .from('loyalty_subscriptions')
                .select('status, plan:loyalty_plans(price, billing_cycle)')
                .eq('company_id', currentEntity.id);

            if (error) throw error;

            if (subs) {
                const active = subs.filter(s => s.status === 'active');
                const overdue = subs.filter(s => s.status === 'overdue' || s.status === 'past_due');
                
                const mrr = active.reduce((acc, sub: any) => {
                    const price = sub.plan?.price || 0;
                    return acc + (sub.plan?.billing_cycle === 'yearly' ? price / 12 : price);
                }, 0);

                setStats({
                    activeSubscribers: active.length,
                    mrr,
                    overdueCount: overdue.length
                });
            }
        } catch (err) {
            console.error('Error fetching loyalty stats:', err);
        }
    };

    const fetchPlans = async () => {
        if (!currentEntity.id || currentEntity.type !== 'company') return;
        try {
            const { data, error } = await supabase
                .from('loyalty_plans')
                .select('*')
                .eq('company_id', currentEntity.id)
                .order('display_order', { ascending: true });

            if (error) throw error;
            setPlans(data || []);
        } catch (err) {
            console.error('Error fetching loyalty plans:', err);
        }
    };

    const fetchSettings = async () => {
        if (!currentEntity.id || currentEntity.type !== 'company') return;
        try {
            const { data, error } = await supabase
                .from('loyalty_settings')
                .select('*')
                .eq('company_id', currentEntity.id)
                .maybeSingle();

            if (error) throw error;
            
            if (!data) {
                // Initialize settings if not exists using upsert to avoid 409
                const { data: newData, error: createError } = await supabase
                    .from('loyalty_settings')
                    .upsert([{ company_id: currentEntity.id, enabled: true }], { onConflict: 'company_id' })
                    .select()
                    .single();
                
                if (createError) throw createError;
                setSettings(newData);
            } else {
                setSettings(data);
            }
        } catch (err) {
            console.error('Error fetching loyalty settings:', err);
        }
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchPlans(), fetchSettings(), fetchStats()]);
            setLoading(false);
        };
        load();
    }, [currentEntity.id]);

    const addPlan = async (plan: Omit<LoyaltyPlan, 'id' | 'company_id' | 'created_at' | 'updated_at'>) => {
        if (!currentEntity.id) return;
        const { data, error } = await supabase
            .from('loyalty_plans')
            .insert([{ ...plan, company_id: currentEntity.id }])
            .select()
            .single();

        if (error) throw error;
        setPlans(prev => [...prev, data]);
        fetchStats(); // Update stats
        return data;
    };

    const updatePlan = async (id: string, updates: Partial<LoyaltyPlan>) => {
        const { data, error } = await supabase
            .from('loyalty_plans')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        setPlans(prev => prev.map(p => p.id === id ? data : p));
        fetchStats(); // Update stats
        return data;
    };

    const deletePlan = async (id: string) => {
        const { error } = await supabase
            .from('loyalty_plans')
            .delete()
            .eq('id', id);

        if (error) throw error;
        setPlans(prev => prev.filter(p => p.id !== id));
        fetchStats(); // Update stats
    };

    const updateSettings = async (updates: Partial<LoyaltySettings>) => {
        if (!settings?.id) return;
        const { data, error } = await supabase
            .from('loyalty_settings')
            .update(updates)
            .eq('id', settings.id)
            .select()
            .single();

        if (error) throw error;
        setSettings(data);
        return data;
    };

    return {
        plans,
        settings,
        stats,
        loading,
        addPlan,
        updatePlan,
        deletePlan,
        updateSettings,
        refresh: () => Promise.all([fetchPlans(), fetchSettings(), fetchStats()])
    };
}
