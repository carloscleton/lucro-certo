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
    const [templateWebhooks, setTemplateWebhooks] = useState<(Webhook & { company_name?: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { currentEntity, availableEntities } = useEntity();

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

    // Fetch webhooks from OTHER companies as templates
    const fetchTemplateWebhooks = async () => {
        if (!user || currentEntity.type !== 'company' || !currentEntity.id) {
            setTemplateWebhooks([]);
            return;
        }

        try {
            // Use availableEntities from EntityContext — already has all companies the user belongs to
            const otherCompanies = availableEntities
                .filter(e => e.type === 'company' && e.id && e.id !== currentEntity.id);

            console.log('📋 Templates: other companies from context:', otherCompanies.map(c => ({ id: c.id, name: c.name })));

            if (otherCompanies.length === 0) {
                setTemplateWebhooks([]);
                return;
            }

            // Fetch webhooks from those companies
            const otherCompanyIds = otherCompanies.map(c => c.id!);
            const { data: otherWebhooks, error: whError } = await supabase
                .from('webhooks')
                .select('*')
                .in('company_id', otherCompanyIds)
                .order('name');

            if (whError) {
                console.error('📋 Templates: error fetching webhooks:', whError);
                setTemplateWebhooks([]);
                return;
            }

            console.log('📋 Templates: webhooks found:', otherWebhooks?.length || 0);

            if (!otherWebhooks || otherWebhooks.length === 0) {
                setTemplateWebhooks([]);
                return;
            }

            // Map company names from availableEntities
            const companyMap = new Map<string, string>();
            otherCompanies.forEach(c => companyMap.set(c.id!, c.name));

            const templates = otherWebhooks.map((w: any) => ({
                ...w,
                company_name: companyMap.get(w.company_id) || 'Outra empresa'
            }));

            // Deduplicate by name (keep first occurrence)
            const seen = new Set<string>();
            const unique = templates.filter((t: any) => {
                const key = t.name.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            console.log('📋 Templates: final count:', unique.length);
            setTemplateWebhooks(unique);
        } catch (error) {
            console.error('📋 Templates: unexpected error:', error);
            setTemplateWebhooks([]);
        }
    };

    // Deploy a template webhook to the current company
    const deployWebhook = async (template: Webhook & { company_name?: string }) => {
        if (!user) return;

        const company_id = currentEntity.type === 'company' ? currentEntity.id : null;

        const webhookData = {
            name: template.name,
            url: template.url,
            method: template.method,
            events: template.events,
            headers: template.headers || {},
            auth_username: template.auth_username,
            auth_password: template.auth_password,
            is_active: false, // Start as inactive for review
            user_id: user.id,
            company_id
        };

        const { error } = await supabase
            .from('webhooks')
            .insert([webhookData])
            .select();

        if (error) throw error;
        await fetchWebhooks();
    };

    useEffect(() => {
        fetchWebhooks();
    }, [user, currentEntity]);

    // Fetch templates when webhooks are loaded and empty
    useEffect(() => {
        if (!loading && webhooks.length === 0 && availableEntities.length > 1) {
            fetchTemplateWebhooks();
        }
    }, [loading, webhooks.length, currentEntity, availableEntities]);

    const createWebhook = async (webhook: Omit<Webhook, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
        console.log('🔧 Creating webhook:', webhook);

        if (!user) {
            console.error('❌ No user found!');
            return;
        }

        const company_id = currentEntity.type === 'company' ? currentEntity.id : null;

        const webhookData = { ...webhook, user_id: user.id, company_id };

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
        templateWebhooks,
        loading,
        createWebhook,
        updateWebhook,
        deleteWebhook,
        toggleWebhook,
        deployWebhook,
        getWebhookLogs,
        refresh: fetchWebhooks
    };
}
