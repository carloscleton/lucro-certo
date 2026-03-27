import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugSettings() {
    try {
        const { data: settings, error: sErr } = await supabase.from('app_settings').select('*').eq('id', 1).single()
        if (sErr) throw sErr
        console.log('--- App Settings (Keys Only) ---')
        console.log(Object.keys(settings).join(', '))
        
        console.log('\n--- Notification Config ---')
        console.log({
            platform_whatsapp_instance: settings.platform_whatsapp_instance,
            platform_evolution_api_url: settings.platform_evolution_api_url,
            platform_evolution_api_key: settings.platform_evolution_api_key ? 'SET' : 'MISSING',
            loyalty_whatsapp_enabled: settings.loyalty_whatsapp_enabled,
            loyalty_email_enabled: settings.loyalty_email_enabled,
            resend_api_key: settings.resend_api_key ? 'SET' : 'MISSING'
        })

        const { data: companies } = await supabase.from('companies').select('id, trade_name').limit(1)
        console.log('\n--- First Company ---')
        console.log(JSON.stringify(companies, null, 2))

    } catch (e) {
        console.error('Debug Error:', e)
    }
}

debugSettings()
