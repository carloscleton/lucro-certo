import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Parse request body
        const { webhookId, eventType, payload } = await req.json()

        // Get Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Fetch webhook configuration
        const { data: webhook, error: webhookError } = await supabase
            .from('webhooks')
            .select('*')
            .eq('id', webhookId)
            .single()

        if (webhookError || !webhook) {
            throw new Error('Webhook not found')
        }

        // Prepare headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'LucroCerto-Webhook/1.0',
            ...webhook.headers,
        }

        // Add Basic Auth if credentials are provided
        if (webhook.auth_username && webhook.auth_password) {
            const credentials = btoa(`${webhook.auth_username}:${webhook.auth_password}`)
            headers['Authorization'] = `Basic ${credentials}`
        }

        // Make HTTP request to external webhook
        let statusCode: number | undefined
        let response: string | undefined
        let errorMessage: string | undefined

        try {
            const fetchResponse = await fetch(webhook.url, {
                method: webhook.method || 'POST',
                headers,
                body: webhook.method !== 'GET' ? JSON.stringify({
                    event: eventType,
                    timestamp: new Date().toISOString(),
                    data: payload,
                }) : undefined,
                signal: AbortSignal.timeout(10000), // 10 second timeout
            })

            statusCode = fetchResponse.status
            response = await fetchResponse.text()

            if (!fetchResponse.ok) {
                errorMessage = `HTTP ${statusCode}: ${response}`
            }
        } catch (error: any) {
            errorMessage = error.message || 'Unknown error'
            console.error('Webhook execution failed:', error)
        }

        // Log the execution
        await supabase
            .from('webhook_logs')
            .insert([{
                webhook_id: webhookId,
                event_type: eventType,
                payload,
                status_code: statusCode,
                response: response?.substring(0, 5000), // Limit response size
                error_message: errorMessage,
            }])

        return new Response(
            JSON.stringify({
                success: !errorMessage,
                statusCode,
                response: response?.substring(0, 5000),
                error: errorMessage,
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error: any) {
        console.error('Edge function error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
