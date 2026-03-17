import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const EVO_API_URL = Deno.env.get('EVOLUTION_API_URL') || 'https://evo.idealzap.com.br'
const EVO_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '7c4678985d13dfd7a89d4e56e7503563'

async function sendWhatsApp(instanceName: string, targetNumber: string, text: string) {
    try {
        const response = await fetch(`${EVO_API_URL}/message/sendText/${encodeURIComponent(instanceName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVO_API_KEY },
            body: JSON.stringify({
                number: targetNumber,
                options: { delay: 1200, presence: "composing" },
                textMessage: { text }
            })
        })
        return response.ok
    } catch (e) {
        console.error('Error sending WhatsApp:', e)
        return false
    }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { company_id } = await req.json()
        if (!company_id) throw new Error('Missing company_id')

        // 1. Fetch Company and Owner Info
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select(`
                *,
                members:company_members(
                    role,
                    profiles(full_name, phone, email)
                )
            `)
            .eq('id', company_id)
            .single()

        if (companyError || !company) throw new Error('Company not found')

        // 2. Get Owner
        const ownerMember = company.members.find((m: any) => m.role === 'owner' || m.role === 'admin')
        const owner = ownerMember?.profiles
        const targetNumber = owner?.phone || company.phone

        if (!targetNumber) {
            return new Response(JSON.stringify({ success: false, message: 'No target phone number found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 3. Fetch App Settings for Template
        const { data: settings } = await supabase
            .from('app_settings')
            .select('*')
            .eq('id', 1)
            .single()

        if (!settings?.welcome_whatsapp_enabled) {
            return new Response(JSON.stringify({ success: false, message: 'Welcome messages are disabled' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const waInstance = settings.platform_whatsapp_instance || 'MainAdmin'
        const template = settings.welcome_whatsapp_template || 'Olá, {full_name}! 👋 Bem-vindo ao Lucro Certo.'

        const message = template
            .replace(/{full_name}/g, owner?.full_name || 'Amigo(a)')
            .replace(/{company_name}/g, company.trade_name || 'sua empresa');

        let cleanPhone = targetNumber.replace(/\D/g, '')
        
        // Prepend 55 if standard BR number without country code
        if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }

        if (cleanPhone.length >= 10) {
            const success = await sendWhatsApp(waInstance, cleanPhone, message)
            console.log(`Welcome message sent to ${owner?.full_name}: ${success}`)
            return new Response(JSON.stringify({ success }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        return new Response(JSON.stringify({ success: false, message: 'Invalid phone number' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
