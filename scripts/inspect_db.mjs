import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oncddbarrtxalsmzravk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uY2RkYmFycnR4YWxzbXpyYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjM3OTksImV4cCI6MjA4NTE5OTc5OX0.tjjFH4dX1AVI8ZdS7H61Oj2UDe6k2WPQJ8V5gkgPiE0'
const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectTable() {
    try {
        const { data: settings, error } = await supabase.from('app_settings').select('*').limit(1)
        if (error) throw error
        console.log('--- App Settings ---')
        if (settings && settings[0]) {
            const s = settings[0]
            const evoKeys = Object.keys(s).filter(k => k.toLowerCase().includes('evolution') || k.toLowerCase().includes('whatsapp'))
            console.log('Relevant Keys:', evoKeys.join(', '))
            
            const results = {}
            evoKeys.forEach(k => results[k] = s[k])
            console.log('\nValues:', JSON.stringify(results, null, 2))
        }
    } catch (e) {
        console.error('Inspect Error:', e)
    }
}

inspectTable()
