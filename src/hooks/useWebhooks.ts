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
    const [debugInfo, setDebugInfo] = useState<string[]>([]);
    const { user } = useAuth();
    const { currentEntity, availableEntities } = useEntity();

    const ADMIN_EMAIL = 'carloscleton.nat@gmail.com';
    const isAdmin = user?.email === ADMIN_EMAIL;

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
        const logs: string[] = [];
        logs.push(`Admin: ${isAdmin ? 'Sim' : 'Não'} | Empresa: ${currentEntity.name}`);

        if (!user || currentEntity.type !== 'company' || !currentEntity.id) {
            setDebugInfo(logs);
            setTemplateWebhooks([]);
            return;
        }

        try {
            if (isAdmin) {
                // Admin: single RPC does everything (bypasses RLS via SECURITY DEFINER)
                logs.push('Chamando RPC get_template_webhooks...');
                const { data, error } = await supabase
                    .rpc('get_template_webhooks', { current_company_id: currentEntity.id });

                if (error) {
                    logs.push(`❌ Erro: ${error.message}`);
                    setDebugInfo(logs);
                    setTemplateWebhooks([]);
                    return;
                }

                const webhookData = data || [];
                logs.push(`Webhooks encontrados: ${webhookData.length}`);

                // Deduplicate by name
                const seen = new Set<string>();
                const unique = webhookData.filter((t: any) => {
                    const key = t.name.toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                logs.push(`✅ Templates finais: ${unique.length}`);
                unique.forEach((t: any) => logs.push(`  ✓ ${t.name} (${t.company_name})`));
                setDebugInfo(logs);
                setTemplateWebhooks(unique);
            } else {
                // Regular user: use availableEntities + direct query
                const otherCompanies = availableEntities
                    .filter(e => e.type === 'company' && e.id && e.id !== currentEntity.id);

                if (otherCompanies.length === 0) {
                    setDebugInfo(logs);
                    setTemplateWebhooks([]);
                    return;
                }

                const otherCompanyIds = otherCompanies.map(c => c.id!);
                const { data: otherWebhooks, error: whError } = await supabase
                    .from('webhooks')
                    .select('*')
                    .in('company_id', otherCompanyIds)
                    .order('name');

                if (whError || !otherWebhooks || otherWebhooks.length === 0) {
                    setTemplateWebhooks([]);
                    return;
                }

                const companyMap = new Map<string, string>();
                otherCompanies.forEach(c => companyMap.set(c.id!, c.name));

                const templates = otherWebhooks.map((w: any) => ({
                    ...w,
                    company_name: companyMap.get(w.company_id) || 'Outra empresa'
                }));

                setTemplateWebhooks(templates);
            }
        } catch (error: any) {
            logs.push(`❌ Erro: ${error.message}`);
            setDebugInfo(logs);
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
        if (!loading && webhooks.length === 0) {
            fetchTemplateWebhooks();
        }
    }, [loading, webhooks.length, currentEntity, availableEntities]);

    const createWebhook = async (webhook: Omit<Webhook, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
        if (!user) return;

        const company_id = currentEntity.type === 'company' ? currentEntity.id : null;
        const webhookData = { ...webhook, user_id: user.id, company_id };

        const { error } = await supabase
            .from('webhooks')
            .insert([webhookData])
            .select();

        if (error) throw error;
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
        debugInfo,
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
