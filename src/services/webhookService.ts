import { supabase } from '../lib/supabase';
import type { WebhookEvent } from '../hooks/useWebhooks';

interface TriggerWebhookParams {
    eventType: WebhookEvent;
    payload: any;
    companyId?: string;
    userId: string;
}

export const webhookService = {
    /**
     * Trigger all active webhooks for a specific event
     */
    async triggerWebhooks({ eventType, payload, companyId, userId }: TriggerWebhookParams) {
        console.log('🚀 WEBHOOK TRIGGER CALLED!');
        console.log('📋 Event Type:', eventType);
        console.log('📦 Payload:', payload);
        console.log('🏢 Company ID:', companyId);
        console.log('👤 User ID:', userId);

        try {
            // Fetch active webhooks that listen to this event
            let query = supabase
                .from('webhooks')
                .select('*')
                .eq('is_active', true)
                .contains('events', [eventType]);

            if (companyId) {
                query = query.eq('company_id', companyId);
            } else {
                query = query.eq('user_id', userId).is('company_id', null);
            }

            console.log('🔍 Fetching webhooks from database...');
            const { data: webhooks, error } = await query;

            if (error) {
                console.error('❌ Error fetching webhooks:', error);
                return;
            }

            console.log('📊 Webhooks found:', webhooks?.length || 0);
            console.log('📋 Webhooks data:', webhooks);

            if (!webhooks || webhooks.length === 0) {
                console.warn('⚠️ No webhooks configured for this event!');
                return; // No webhooks configured for this event
            }

            // Fetch active WhatsApp instance for enrichment
            let waQuery = supabase
                .from('instances')
                .select('instance_name, evolution_instance_id, status')
                .eq('status', 'connected');

            if (companyId) {
                waQuery = waQuery.eq('company_id', companyId);
            } else {
                waQuery = waQuery.eq('user_id', userId).is('company_id', null);
            }

            const { data: waInstances } = await waQuery.limit(1);
            const activeWhatsApp = waInstances?.[0] ? {
                instanceName: waInstances[0].instance_name,
                instanceId: waInstances[0].evolution_instance_id,
                status: waInstances[0].status
            } : null;

            console.log('📱 Active WhatsApp Instance found:', activeWhatsApp);

            console.log(`✅ Executing ${webhooks.length} webhook(s)...`);
            // Execute all webhooks
            const promises = webhooks.map(webhook => {
                console.log(`📤 Executing webhook: ${webhook.name}`);
                return this.executeWebhook(webhook, eventType, payload, activeWhatsApp);
            });

            await Promise.allSettled(promises);
            console.log('✅ All webhooks executed!');
        } catch (error) {
            console.error('❌ Error triggering webhooks:', error);
        }
    },

    /**
     * Execute a single webhook - Direct HTTP request
     */
    async executeWebhook(webhook: any, eventType: string, payload: any, whatsappData: any = null) {
        console.log(`🔧 executeWebhook called for: ${webhook.name}`);
        console.log(`🌐 URL: ${webhook.url}`);
        console.log(`📡 Method: ${webhook.method}`);

        let statusCode: number | undefined;
        let response: string | undefined;
        let errorMessage: string | undefined;

        try {
            // Prepare headers
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'LucroCerto-Webhook/1.0',
                ...webhook.headers
            };

            // Add Basic Auth if credentials are provided
            if (webhook.auth_username && webhook.auth_password) {
                const credentials = btoa(`${webhook.auth_username}:${webhook.auth_password}`);
                headers['Authorization'] = `Basic ${credentials}`;
                console.log('🔒 Basic Auth added');
            }

            const requestBody = {
                event: eventType,
                timestamp: new Date().toISOString(),
                whatsapp: whatsappData,
                data: payload
            };

            console.log('📦 Request body:', requestBody);
            console.log('📋 Headers:', headers);
            console.log('🚀 Sending HTTP request...');

            // Make HTTP request directly to webhook URL
            const fetchResponse = await fetch(webhook.url, {
                method: webhook.method || 'POST',
                headers,
                body: webhook.method !== 'GET' ? JSON.stringify(requestBody) : undefined,
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });

            statusCode = fetchResponse.status;
            response = await fetchResponse.text();

            console.log(`📥 Response status: ${statusCode}`);
            console.log(`📥 Response body: ${response}`);

            if (!fetchResponse.ok) {
                errorMessage = `HTTP ${statusCode}: ${response}`;
                console.error(`❌ HTTP error: ${errorMessage}`);
            } else {
                console.log(`✅ Webhook sent successfully to ${webhook.name}!`);
            }
        } catch (error: any) {
            // CORS errors will appear here, but the request was still sent
            errorMessage = error.message || 'Unknown error';
            console.error(`❌ Error sending webhook: ${errorMessage}`);
            console.log(`⚠️ Note: CORS errors are expected in browser, but webhook was sent!`);
        } finally {
            console.log('💾 Logging webhook execution...');
            // Log the execution
            await this.logWebhookExecution({
                webhookId: webhook.id,
                eventType,
                payload,
                statusCode,
                response,
                errorMessage
            });
            console.log('✅ Webhook execution logged!');
        }
    },

    /**
     * Log webhook execution
     */
    async logWebhookExecution({
        webhookId,
        eventType,
        payload,
        statusCode,
        response,
        errorMessage
    }: {
        webhookId: string;
        eventType: string;
        payload: any;
        statusCode?: number;
        response?: string;
        errorMessage?: string;
    }) {
        try {
            await supabase
                .from('webhook_logs')
                .insert([{
                    webhook_id: webhookId,
                    event_type: eventType,
                    payload,
                    status_code: statusCode,
                    response: response?.substring(0, 5000), // Limit response size
                    error_message: errorMessage
                }]);
        } catch (error) {
            console.error('Error logging webhook execution:', error);
        }
    },

    /**
     * Test a webhook with sample data
     */
    async testWebhook(webhook: any) {
        const testPayload = {
            test: true,
            message: 'This is a test webhook from Lucro Certo',
            timestamp: new Date().toISOString()
        };

        await this.executeWebhook(webhook, 'TEST', testPayload);
    }
};
