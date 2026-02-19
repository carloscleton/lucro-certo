import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

export type WebhookEvent =
    | 'QUOTE_CREATED'
    | 'QUOTE_SENT'
    | 'QUOTE_APPROVED'
    | 'QUOTE_REJECTED'
    | 'TRANSACTION_CREATED'
    | 'TRANSACTION_PAID'
    | 'CONTACT_CREATED'
    | 'COMMISSION_GENERATED'
    | 'SUPPORT_REQUEST'
    | 'GENERIC_EVENT';

export interface Webhook {
    id: string;
    company_id?: string;
    user_id: string;
    name: string;
    url: string;
    method: 'POST' | 'GET' | 'PUT' | 'PATCH';
    events: WebhookEvent[];
    headers?: Record<string, string>;
    auth_username?: string;
    auth_password?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface WebhookLog {
    id: string;
    webhook_id: string;
    event_type: string;
    payload: any;
    status_code?: number;
    response?: string;
    error_message?: string;
    created_at: string;
}

export function useWebhooks() {
    const [webhooks, setWebhooks] = useState<Webhook[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const fetchWebhooks = async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('webhooks')
                .select('*')
                .order('created_at', { ascending: false });

            if (currentEntity.type === 'company' && currentEntity.id) {
                query = query.eq('company_id', currentEntity.id);
            } else {
                query = query.eq('user_id', user.id).is('company_id', null);
            }

            const { data, error } = await query;

            if (error) throw error;
            setWebhooks(data || []);
        } catch (error) {
            console.error('Error fetching webhooks:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWebhooks();
    }, [user, currentEntity]);

    const createWebhook = async (webhook: Omit<Webhook, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
        console.log('🔧 Creating webhook:', webhook);

        if (!user) {
            console.error('❌ No user found!');
            return;
        }

        const company_id = currentEntity.type === 'company' ? currentEntity.id : null;
        console.log('🏢 Company ID:', company_id);
        console.log('👤 User ID:', user.id);

        const webhookData = { ...webhook, user_id: user.id, company_id };
        console.log('📦 Webhook data to insert:', webhookData);

        const { data, error } = await supabase
            .from('webhooks')
            .insert([webhookData])
            .select();

        if (error) {
            console.error('❌ Error creating webhook:', error);
            throw error;
        }

        console.log('✅ Webhook created successfully:', data);
        await fetchWebhooks();
    };

    const updateWebhook = async (id: string, updates: Partial<Webhook>) => {
        const { error } = await supabase
            .from('webhooks')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
        await fetchWebhooks();
    };

    const deleteWebhook = async (id: string) => {
        const { error } = await supabase
            .from('webhooks')
            .delete()
            .eq('id', id);

        if (error) throw error;
        await fetchWebhooks();
    };

    const toggleWebhook = async (id: string, is_active: boolean) => {
        await updateWebhook(id, { is_active });
    };

    const getWebhookLogs = async (webhookId: string, limit = 50) => {
        const { data, error } = await supabase
            .from('webhook_logs')
            .select('*')
            .eq('webhook_id', webhookId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as WebhookLog[];
    };

    return {
        webhooks,
        loading,
        createWebhook,
        updateWebhook,
        deleteWebhook,
        toggleWebhook,
        getWebhookLogs,
        refresh: fetchWebhooks
    };
}
